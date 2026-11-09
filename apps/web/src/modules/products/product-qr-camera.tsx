import { useEffect, useRef } from 'react'
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { isQrInsideFrame } from './qr-frame'

prepareZXingModule({ overrides: { locateFile: () => wasmUrl } })

export interface ProductQrCameraProps {
  onCode: (code: string) => void
  onError: (error: { kind: 'permission-denied' | 'camera-error' }) => void
}

export function ProductQrCamera({ onCode, onError }: ProductQrCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const callbacks = useRef({ onCode, onError })
  useEffect(() => { callbacks.current = { onCode, onError } }, [onCode, onError])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const detector = new BarcodeDetector({ formats: ['qr_code'] })
    let disposed = false
    let generation = 0
    let stream: MediaStream | null = null
    let frame = 0
    let timeout: ReturnType<typeof setTimeout> | undefined
    let lastScan = 0

    function stop() {
      generation++
      cancelAnimationFrame(frame)
      if (timeout) clearTimeout(timeout)
      timeout = undefined
      stream?.getTracks().forEach(track => track.stop())
      stream = null
      video!.srcObject = null
    }

    async function start() {
      if (disposed || document.hidden) return
      const run = ++generation
      try {
        const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, frameRate: { ideal: 12, max: 15 } }, audio: false })
        if (disposed || run !== generation) {
          acquired.getTracks().forEach(track => track.stop())
          return
        }
        stream = acquired
        video!.srcObject = acquired
        await Promise.race([
          video!.play(),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Camera playback timed out')), 5000) }),
        ])
        if (disposed || run !== generation) return
        if (timeout) clearTimeout(timeout)
        timeout = undefined

        const scan = async (now: number) => {
          if (disposed || run !== generation) return
          if (now - lastScan >= 250 && video!.readyState >= 2) {
            lastScan = now
            try {
              const codes = await detector.detect(video!)
              if (disposed || run !== generation) return
              const inside = codes.filter(code => isQrInsideFrame(code.boundingBox, video!.videoWidth, video!.videoHeight, video!.clientWidth, video!.clientHeight))
              if (inside.length === 1 && inside[0]?.rawValue) {
                callbacks.current.onCode(inside[0].rawValue)
                return
              }
            } catch {
              if (!disposed && run === generation) {
                stop()
                callbacks.current.onError({ kind: 'camera-error' })
              }
              return
            }
          }
          frame = requestAnimationFrame(scan)
        }
        frame = requestAnimationFrame(scan)
      } catch (error) {
        if (disposed || run !== generation) return
        stop()
        callbacks.current.onError({ kind: error instanceof DOMException && error.name === 'NotAllowedError' ? 'permission-denied' : 'camera-error' })
      }
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else void start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    void start()
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [])

  return <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
}
