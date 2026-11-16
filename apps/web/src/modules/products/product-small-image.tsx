import { useState, type ComponentProps } from 'react'
import { useNetworkReadSource } from '@/modules/pwa/read-source'
import { productImageCors } from './_product-image-cors'

const placeholder = '/assets/images/placeholder.svg'

type ImageProps = Omit<ComponentProps<'img'>, 'src' | 'crossOrigin' | 'onError'> & {
  src?: string | null
  thumbnail?: string | null
}

export function ProductSmallImage({ src, thumbnail, ...props }: ImageProps) {
  const online = useNetworkReadSource()
  const original = src || placeholder
  const first = online && thumbnail ? thumbnail : original
  return <SmallImage key={JSON.stringify([first, original])} first={first} original={original} {...props} />
}

function SmallImage({ first, original, loading = 'lazy', ...props }: Omit<ImageProps, 'src' | 'thumbnail'> & {
  first: string
  original: string
}) {
  const [asset, setAsset] = useState({ src: first, withoutCors: false })
  const crossOrigin = asset.withoutCors ? undefined : productImageCors(asset.src)
  return (
    <img
      key={crossOrigin ?? 'default'}
      {...props}
      src={asset.src}
      crossOrigin={crossOrigin}
      loading={loading}
      decoding="async"
      onError={() => {
        if (crossOrigin) setAsset({ ...asset, withoutCors: true })
        else if (asset.src !== original && asset.src !== placeholder) setAsset({ src: original, withoutCors: false })
        else if (asset.src !== placeholder) setAsset({ src: placeholder, withoutCors: false })
      }}
    />
  )
}
