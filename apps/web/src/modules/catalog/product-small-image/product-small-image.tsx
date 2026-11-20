import { type ComponentProps } from 'react'
import { useNetworkReadSource } from '@/modules/pwa/read-source'
import { SmallImage } from './_small-image'

const placeholder = '/assets/images/placeholder.svg'

type ImageProps = Omit<
  ComponentProps<'img'>,
  'src' | 'crossOrigin' | 'onError'
> & {
  src?: string | null
  thumbnail?: string | null
}

export function ProductSmallImage({ src, thumbnail, ...props }: ImageProps) {
  const online = useNetworkReadSource()
  const original = src || placeholder
  const first = online && thumbnail ? thumbnail : original
  return (
    <SmallImage
      key={JSON.stringify([first, original])}
      first={first}
      original={original}
      {...props}
    />
  )
}
