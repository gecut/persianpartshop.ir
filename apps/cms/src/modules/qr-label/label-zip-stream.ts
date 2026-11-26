import { Zip, ZipPassThrough } from 'fflate'

export interface LabelZipEntry {
  name: string
  token: string
}

/**
 * Streams a stored (level 0) ZIP archive, rendering at most one label per consumer pull.
 * `onSettled` runs exactly once: after the last chunk, on a failure, or once a cancelled
 * stream's in-flight render has finished (so the caller's lock never overlaps two renders).
 */
export function labelZipStream(
  entries: readonly LabelZipEntry[],
  render: (token: string) => Promise<Uint8Array>,
  onSettled: (error?: unknown) => void,
): ReadableStream<Uint8Array> {
  if (entries.length === 0) throw new RangeError('no entries')

  let index = 0
  let cancelled = false
  let settled = false
  let inFlight: Promise<void> = Promise.resolve()
  let zip: Zip

  const settle = (...error: [] | [unknown]) => {
    if (settled) return
    settled = true
    onSettled(...error) // no argument on success or cancel
  }
  const stopped = () => cancelled || settled

  async function next(controller: ReadableStreamDefaultController<Uint8Array>) {
    try {
      if (index >= entries.length) return zip.end()
      const entry = entries[index++]!
      await new Promise<void>((resolve) => setImmediate(resolve)) // let other requests run between labels
      if (stopped()) return
      const png = await render(entry.token)
      if (stopped()) return
      const file = new ZipPassThrough(entry.name)
      zip.add(file)
      file.push(png, true)
    } catch (error) {
      if (stopped()) return
      controller.error(error)
      zip.terminate()
      settle(error)
    }
  }

  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        zip = new Zip((error, chunk, final) => {
          if (error) {
            controller.error(error)
            zip.terminate()
            return settle(error)
          }
          if (chunk.length > 0) controller.enqueue(chunk)
          if (final) {
            controller.close()
            settle()
          }
        })
      },
      pull(controller) {
        if (stopped()) return
        inFlight = next(controller)
        return inFlight
      },
      async cancel() {
        cancelled = true
        zip.terminate()
        await inFlight
        settle()
      },
    },
    { highWaterMark: 0 },
  )
}
