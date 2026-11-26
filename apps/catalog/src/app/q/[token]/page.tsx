import { redirect } from 'next/navigation'
import { QrInactive } from '@/modules/qr/_qr-inactive'
import { resolveQrTarget } from '@/modules/qr/qr-server'

export const dynamic = 'force-dynamic'

export default async function QrPage({ params }: { params: Promise<{ token: string }> }) {
  const target = await resolveQrTarget((await params).token)
  if (target.kind === 'product') redirect(`/p/${target.id}`)
  return <QrInactive />
}
