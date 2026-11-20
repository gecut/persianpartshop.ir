import { useState, type ComponentProps } from 'react'
import { productImageCors } from '../product-image-cors'

const placeholder = '/assets/images/placeholder.svg'

export function SmallImage({
  first,
  original,
  loading = 'lazy',
  ...props
}: Omit<ComponentProps<'img'>, 'src' | 'crossOrigin' | 'onError'> & {
  first: string
  original: string
}) {
  const [asset, setAsset] = useState({ src: first, withoutCors: false })
  const crossOrigin = asset.withoutCors
    ? undefined
    : productImageCors(asset.src)
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
        else if (asset.src !== original && asset.src !== placeholder)
          setAsset({ src: original, withoutCors: false })
        else if (asset.src !== placeholder)
          setAsset({ src: placeholder, withoutCors: false })
      }}
    />
  )
}
