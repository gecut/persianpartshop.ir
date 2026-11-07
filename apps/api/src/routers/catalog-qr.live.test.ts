import { expect, test } from 'bun:test'

// This test changes one explicitly named disposable fixture. Never point it at production.
const live = process.env.QR_LIVE_TEST === 'true' ? test : test.skip
live('live HTTP: QR lookup, payload authorization and immediate revocation', async () => {
  expect(new URL(process.env.CMS_API_URL!).origin).toBe('http://127.0.0.1:55174')
  const origin = new URL(process.env.QR_FIXTURE_API_URL!)
  expect(origin.origin).toBe('http://127.0.0.1:55175')
  const { sdk } = await import('../payload')
  const { generateToken } = await import('../lib/jwt')
  const user = (await sdk.find({ collection: 'users', where: { phone: { equals: '09120000001' } }, limit: 1 })).docs[0]!
  const product = (await sdk.find({ collection: 'products', where: { sku: { equals: 'QRTEST' } }, limit: 1 })).docs[0]!
  expect(user.fullName).toBe('Tester')
  expect(product.scanCode).toBe('PP-001')
  const token = await generateToken({ id: user.id, role: 'customer' })
  const adminToken = await generateToken({ id: user.id, role: 'admin' })
  const request = (procedure: string, body: unknown, bearer?: string) => fetch(`${origin.origin}/api/rpc/catalog/${procedure}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ json: body }),
  })
  try {
    await sdk.update({ collection: 'users', id: user.id, data: { canUseProductQr: true } })
    const response = await request('getByScanCode', { scanCode: 'pp-001' }, token)
    expect(response.status).toBe(200)
    const body = await response.json() as { json: Record<string, unknown> }
    expect(body.json).toMatchObject({ id: product.id, finalCustomerPricePerSqm: 110, hasScanCode: true })
    expect(body.json).not.toHaveProperty('scanCode')
    const qr = await request('getProductQr', { id: product.id }, token)
    expect(await qr.json()).toMatchObject({ json: { scanCode: 'PP-001' } })
    expect((await request('getByScanCode', { scanCode: 'PP-001' })).status).toBe(401)
    // Even an admin with the same numeric ID cannot inherit this customer's permission.
    expect((await request('getByScanCode', { scanCode: 'PP-001' }, adminToken)).status).toBe(403)
    await sdk.update({ collection: 'users', id: user.id, data: { canUseProductQr: false } })
    expect((await request('getByScanCode', { scanCode: 'PP-001' }, token)).status).toBe(403)
    expect((await request('getProductQr', { id: product.id }, token)).status).toBe(403)
  } finally {
    await sdk.update({ collection: 'users', id: user.id, data: { canUseProductQr: user.canUseProductQr } })
  }
})
