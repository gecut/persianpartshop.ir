import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  maskPhone,
  maskEndpoint,
  sanitizeToken,
  normalizeReceptor,
  sendKavenegarPattern,
} from './kavenegar-client'
import { SMS_TEMPLATES } from './constants'
import { processSmsQueueTick } from './queue-worker'
import { enqueueSms } from './queue-service'
import { getNotificationSettings } from '../../globals/notification-settings.global'
import { retrySmsEndpoint } from '../../collections/sms-queue/_retry-sms.endpoint'
import { sendOtpBeforeChange } from '../../collections/otps/_send-otp.before-change'
import type { Payload } from 'payload'

test('SMS client utilities: maskPhone, maskEndpoint, sanitizeToken, normalizeReceptor', () => {
  // 1. maskPhone
  assert.equal(maskPhone(''), '***')
  assert.equal(maskPhone('12345'), '***')
  assert.equal(maskPhone('09123456789'), '0912***6789')
  assert.equal(maskPhone('09123451234'), '0912***1234')
  assert.equal(maskPhone('09351112233'), '0935***2233')

  // 2. maskEndpoint
  const rawUrl = 'https://api.kavenegar.com/v1/46437751615871547A59364B75376339706E72384266734A596F3476644B653641356171462F557A5747383D/verify/lookup.json'
  const masked = maskEndpoint(rawUrl)
  assert.equal(masked, 'https://api.kavenegar.com/v1/***/verify/lookup.json')
  assert.doesNotMatch(masked, /4643775161/)

  // 3. sanitizeToken
  assert.equal(sanitizeToken(null), '')
  assert.equal(sanitizeToken(undefined), '')
  assert.equal(sanitizeToken(''), '')
  // Persian digits normalized
  assert.equal(sanitizeToken('۱۲۳۴'), '1234')
  // Arabic digits normalized
  assert.equal(sanitizeToken('١٢٣٤٥٦٧٨٩٠'), '1234567890')
  // When spaces are not allowed (standard token), spaces and ZWNJs are stripped completely
  assert.equal(sanitizeToken('شرکت بازرگانی پرشین'), 'شرکتبازرگانیپرشین')
  assert.equal(sanitizeToken('  طرح   ویژه  همکاران  '), 'طرحویژههمکاران')
  assert.equal(sanitizeToken('\u200Cسلام همکار\u200C'), 'سلامهمکار')
  // When spaces are allowed (token10/token20), spaces are collapsed into single spaces and capped
  assert.equal(sanitizeToken('شرکت  بازرگانی   پرشین', { allowSpaces: true }), 'شرکت بازرگانی پرشین')
  assert.equal(sanitizeToken('  طرح   ویژه  همکاران  ', { allowSpaces: true }), 'طرح ویژه همکاران')
  assert.equal(sanitizeToken('یک دو سه چهار پنج شش هفت هشت', { allowSpaces: true, maxSpaces: 5 }), 'یک دو سه چهار پنج شش')

  // 4. normalizeReceptor
  assert.equal(normalizeReceptor(''), '')
  assert.equal(normalizeReceptor('09123456789'), '09123456789')
  assert.equal(normalizeReceptor('  09123456789  '), '09123456789')
  assert.equal(normalizeReceptor('0912 345 6789'), '09123456789')
  assert.equal(normalizeReceptor('0912-345-6789'), '09123456789')
  assert.equal(normalizeReceptor('+989123456789'), '09123456789')
  assert.equal(normalizeReceptor('00989123456789'), '09123456789')
  assert.equal(normalizeReceptor('989123456789'), '09123456789')
  assert.equal(normalizeReceptor('9123456789'), '09123456789')
  assert.equal(normalizeReceptor('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789')
  assert.equal(normalizeReceptor('٠٩١٢٣٤٥٦٧٨٩'), '09123456789')
})

test('sendKavenegarPattern: dev/test mode bypassing and missing key validation', async () => {
  const origEnv = process.env.NODE_ENV
  const origKey = process.env.KAVENEGAR_API_KEY
  const origDisabled = process.env.DISABLE_SMS

  try {
    // 1. DISABLE_SMS = true
    process.env.DISABLE_SMS = 'true'
    delete process.env.KAVENEGAR_API_KEY
    const resDisabled = await sendKavenegarPattern({
      template: SMS_TEMPLATES.OTP,
      receptor: '09123456789',
      tokens: { token: '1234' },
    })
    assert.deepEqual(resDisabled, { success: true })

    // 2. Development mode with no API key
    delete process.env.DISABLE_SMS
    ;(process.env as any).NODE_ENV = 'development'
    delete process.env.KAVENEGAR_API_KEY
    const resDev = await sendKavenegarPattern({
      template: SMS_TEMPLATES.OTP,
      receptor: '09123456789',
      tokens: { token: '5678' },
    })
    assert.deepEqual(resDev, { success: true })

    // 3. Production mode without API key throws
    ;(process.env as any).NODE_ENV = 'production'
    delete process.env.KAVENEGAR_API_KEY
    await assert.rejects(
      async () => {
        await sendKavenegarPattern({
          template: SMS_TEMPLATES.ORDER_REGISTERED,
          receptor: '09123456789',
          tokens: { token: '10001' },
        })
      },
      { message: /KAVENEGAR_API_KEY/ }
    )
  } finally {
    ;(process.env as any).NODE_ENV = origEnv
    if (origKey !== undefined) process.env.KAVENEGAR_API_KEY = origKey
    else delete process.env.KAVENEGAR_API_KEY
    if (origDisabled !== undefined) process.env.DISABLE_SMS = origDisabled
    else delete process.env.DISABLE_SMS
  }
})

test('sendKavenegarPattern: live fetch with successful status and token parameters', async () => {
  const origEnv = process.env.NODE_ENV
  const origKey = process.env.KAVENEGAR_API_KEY
  const origDisabled = process.env.DISABLE_SMS
  const origFetch = globalThis.fetch

  try {
    ;(process.env as any).NODE_ENV = 'production'
    process.env.KAVENEGAR_API_KEY = 'mock-api-key'
    delete process.env.DISABLE_SMS

    let capturedUrl = ''
    let capturedBody = ''
    globalThis.fetch = async (url, init) => {
      capturedUrl = String(url)
      capturedBody = String(init?.body)
      return new Response(
        JSON.stringify({
          return: { status: 200, message: 'تایید شد' },
          entries: [{ messageid: 998877 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = await sendKavenegarPattern({
      template: SMS_TEMPLATES.ADMIN_NEW_ORDER,
      receptor: '۰۹۱۲۳۴۵۶۷۸۹',
      tokens: {
        token: '10042',
        token10: 'علی محمدی',
      },
    })

    assert.equal(result.success, true)
    assert.equal(result.messageId, 998877)
    assert.ok(capturedUrl.includes('/mock-api-key/verify/lookup.json'))

    const parsedParams = new URLSearchParams(capturedBody)
    assert.equal(parsedParams.get('receptor'), '09123456789')
    assert.equal(parsedParams.get('template'), 'admin-new-order')
    assert.equal(parsedParams.get('token'), '10042')
    assert.equal(parsedParams.get('token10'), 'علی محمدی')
  } finally {
    ;(process.env as any).NODE_ENV = origEnv
    globalThis.fetch = origFetch
    if (origKey !== undefined) process.env.KAVENEGAR_API_KEY = origKey
    else delete process.env.KAVENEGAR_API_KEY
    if (origDisabled !== undefined) process.env.DISABLE_SMS = origDisabled
    else delete process.env.DISABLE_SMS
  }
})

test('sendKavenegarPattern: rejects on API error and masks sensitive information', async () => {
  const origEnv = process.env.NODE_ENV
  const origKey = process.env.KAVENEGAR_API_KEY
  const origDisabled = process.env.DISABLE_SMS
  const origFetch = globalThis.fetch
  const origError = console.error
  const loggedErrors: any[] = []

  try {
    ;(process.env as any).NODE_ENV = 'production'
    process.env.KAVENEGAR_API_KEY = 'secret-api-key-999'
    delete process.env.DISABLE_SMS
    console.error = (...args: any[]) => loggedErrors.push(args)

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          return: { status: 411, message: 'دریافت کننده نامعتبر است' },
        }),
        { status: 200 }
      )
    }

    await assert.rejects(
      async () => {
        await sendKavenegarPattern({
          template: SMS_TEMPLATES.OTP,
          receptor: '09129998877',
          tokens: { token: '9876' },
        })
      },
      { message: /دریافت کننده نامعتبر است/ }
    )

    assert.ok(loggedErrors.length > 0)
    const errorString = JSON.stringify(loggedErrors)
    assert.doesNotMatch(errorString, /secret-api-key-999/)
    assert.doesNotMatch(errorString, /09129998877/)
    assert.match(errorString, /0912\*\*\*8877/)
    assert.match(errorString, /\/v1\/\*\*\*\//)
  } finally {
    ;(process.env as any).NODE_ENV = origEnv
    globalThis.fetch = origFetch
    console.error = origError
    if (origKey !== undefined) process.env.KAVENEGAR_API_KEY = origKey
    else delete process.env.KAVENEGAR_API_KEY
    if (origDisabled !== undefined) process.env.DISABLE_SMS = origDisabled
    else delete process.env.DISABLE_SMS
  }
})

test('processSmsQueueTick: transitions jobs through pending, retry_scheduled, and failed with FIFO order and accurate attempts', async () => {
  const origEnv = process.env.NODE_ENV
  const origKey = process.env.KAVENEGAR_API_KEY
  const origDisabled = process.env.DISABLE_SMS
  const origFetch = globalThis.fetch

  try {
    ;(process.env as any).NODE_ENV = 'production'
    process.env.KAVENEGAR_API_KEY = 'test-key'
    delete process.env.DISABLE_SMS

    // Scenario 1: Successful send
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ return: { status: 200, message: 'OK' } }), { status: 200 })
    }

    const updates: Array<{ id: string | number; data: any; overrideAccess?: boolean }> = []
    let capturedFindParams: any = null
    const mockPayloadSuccess = {
      find: async (params: any) => {
        capturedFindParams = params
        return {
          docs: [
            {
              id: 'job-1',
              template: SMS_TEMPLATES.ORDER_REGISTERED,
              receptor: '09121112233',
              tokens: { token: '1001' },
              attempts: 0,
              status: 'pending',
            },
          ],
        }
      },
      update: async (params: any) => {
        updates.push(params)
        return params
      },
      logger: { error: () => {} },
    } as unknown as Payload

    const processed = await processSmsQueueTick(mockPayloadSuccess)
    assert.equal(processed, 1)
    assert.equal(capturedFindParams?.sort, 'createdAt')
    assert.equal(capturedFindParams?.overrideAccess, true)
    assert.equal(updates.length, 1)
    assert.equal(updates[0]?.data?.status, 'sent')
    assert.equal(updates[0]?.data?.attempts, 1)
    assert.equal(updates[0]?.data?.lastError, null)
    assert.equal(updates[0]?.overrideAccess, true)
    assert.ok(updates[0]?.data?.sentAt)

    // Scenario 2: First failure schedules retry in 30s
    globalThis.fetch = async () => {
      throw new Error('Network failure simulation')
    }

    const retryUpdates: Array<{ id: string | number; data: any; overrideAccess?: boolean }> = []
    const mockPayloadFail1 = {
      find: async () => ({
        docs: [
          {
            id: 'job-2',
            template: SMS_TEMPLATES.ORDER_APPROVED,
            receptor: '09121112233',
            tokens: { token: '1002' },
            attempts: 0,
            status: 'pending',
          },
        ],
      }),
      update: async (params: any) => {
        retryUpdates.push(params)
        return params
      },
      logger: { error: () => {} },
    } as unknown as Payload

    await processSmsQueueTick(mockPayloadFail1)
    assert.equal(retryUpdates.length, 1)
    assert.equal(retryUpdates[0]?.data?.status, 'retry_scheduled')
    assert.equal(retryUpdates[0]?.data?.attempts, 1)
    assert.equal(retryUpdates[0]?.overrideAccess, true)
    assert.match(retryUpdates[0]?.data?.lastError, /Network failure simulation/)
    assert.ok(retryUpdates[0]?.data?.nextRetryAt)

    // Scenario 3: Second failure marks as failed definitively
    const failedUpdates: Array<{ id: string | number; data: any; overrideAccess?: boolean }> = []
    const mockPayloadFail2 = {
      find: async () => ({
        docs: [
          {
            id: 'job-3',
            template: SMS_TEMPLATES.ORDER_APPROVED,
            receptor: '09121112233',
            tokens: { token: '1003' },
            attempts: 1,
            status: 'retry_scheduled',
          },
        ],
      }),
      update: async (params: any) => {
        failedUpdates.push(params)
        return params
      },
      logger: { error: () => {} },
    } as unknown as Payload

    await processSmsQueueTick(mockPayloadFail2)
    assert.equal(failedUpdates.length, 1)
    assert.equal(failedUpdates[0]?.data?.status, 'failed')
    assert.equal(failedUpdates[0]?.data?.attempts, 2)
    assert.equal(failedUpdates[0]?.overrideAccess, true)
    assert.match(failedUpdates[0]?.data?.lastError, /Network failure simulation/)
  } finally {
    ;(process.env as any).NODE_ENV = origEnv
    globalThis.fetch = origFetch
    if (origKey !== undefined) process.env.KAVENEGAR_API_KEY = origKey
    else delete process.env.KAVENEGAR_API_KEY
    if (origDisabled !== undefined) process.env.DISABLE_SMS = origDisabled
    else delete process.env.DISABLE_SMS
  }
})

test('enqueueSms: normalizes receptor, ignores empty, and enforces overrideAccess', async () => {
  let createdParams: any = null
  const mockPayload = {
    create: async (params: any) => {
      createdParams = params
      return params
    },
  } as unknown as Payload

  // 1. Normalizes Persian digits receptor and includes overrideAccess: true
  await enqueueSms(mockPayload, {
    receptor: '۰۹۱۲۳۴۵۶۷۸۹',
    template: SMS_TEMPLATES.ORDER_REGISTERED,
    tokens: { token: '9901' },
  })
  assert.equal(createdParams?.data?.receptor, '09123456789')
  assert.equal(createdParams?.data?.template, 'order-registered')
  assert.equal(createdParams?.overrideAccess, true)

  // 2. Ignores empty or blank receptor
  createdParams = null
  await enqueueSms(mockPayload, {
    receptor: '   ',
    template: SMS_TEMPLATES.ORDER_REGISTERED,
    tokens: { token: '9902' },
  })
  assert.equal(createdParams, null)
})

test('getNotificationSettings: reads global with overrideAccess and normalizes admin phones', async () => {
  let findGlobalParams: any = null
  const mockPayload = {
    findGlobal: async (params: any) => {
      findGlobalParams = params
      return {
        adminPhones: [
          { phone: '+989121112233', name: 'مدیر ۱' },
          { phone: '۰۹۳۵۲۲۲۳۳۴۴', name: 'مدیر ۲' },
        ],
        enableOrderNotifications: true,
        enableSupplyNotifications: false,
      }
    },
  } as unknown as Payload

  const settings = await getNotificationSettings(mockPayload)
  assert.equal(findGlobalParams?.slug, 'notification-settings')
  assert.equal(findGlobalParams?.overrideAccess, true)
  assert.deepEqual(settings.adminPhones, ['09121112233', '09352223344'])
  assert.equal(settings.enableOrderNotifications, true)
  assert.equal(settings.enableSupplyNotifications, false)
})

test('retrySmsEndpoint: enforces role, integer ID, failed status requirement, and overrideAccess', async () => {
  // 1. Rejects unauthenticated or non-manager/superadmin
  const unauthRes = await (retrySmsEndpoint as any).handler({
    user: { collection: 'admins', role: 'editor', isActive: true },
    routeParams: { id: '10' },
  })
  assert.equal(unauthRes.status, 403)

  // 2. Rejects invalid ID
  const invalidIdRes = await (retrySmsEndpoint as any).handler({
    user: { collection: 'admins', role: 'manager', isActive: true },
    routeParams: { id: 'abc' },
  })
  assert.equal(invalidIdRes.status, 400)

  // 3. Returns 404 if doc not found
  const notFoundRes = await (retrySmsEndpoint as any).handler({
    user: { collection: 'admins', role: 'superadmin', isActive: true },
    routeParams: { id: '99' },
    payload: {
      findByID: async () => null,
    },
  })
  assert.equal(notFoundRes.status, 404)

  // 4. Rejects retrying non-failed (e.g. sent) SMS
  const notFailedRes = await (retrySmsEndpoint as any).handler({
    user: { collection: 'admins', role: 'superadmin', isActive: true },
    routeParams: { id: '10' },
    payload: {
      findByID: async () => ({ id: 10, status: 'sent' }),
    },
  })
  assert.equal(notFailedRes.status, 400)

  // 5. Successfully resets failed SMS with overrideAccess: true
  let updatedParams: any = null
  const successRes = await (retrySmsEndpoint as any).handler({
    user: { collection: 'admins', role: 'superadmin', isActive: true },
    routeParams: { id: '12' },
    payload: {
      findByID: async () => ({ id: 12, status: 'failed' }),
      update: async (params: any) => {
        updatedParams = params
        return params
      },
    },
  })
  assert.equal(successRes.status, 200)
  assert.equal(updatedParams?.data?.status, 'pending')
  assert.equal(updatedParams?.data?.attempts, 0)
  assert.equal(updatedParams?.overrideAccess, true)
})

test('sendOtpBeforeChange: requires receptor, skips on context.skipSms, and skips on unchanged code', async () => {
  let smsSent = false
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => {
    smsSent = true
    return new Response(JSON.stringify({ return: { status: 200, message: 'OK' } }), { status: 200 })
  }

  try {
    // 1. Skips if context.skipSms is true
    smsSent = false
    await sendOtpBeforeChange({
      data: { code: '1111', phone: '09121112233' },
      originalDoc: { code: '2222' },
      context: { skipSms: true },
    } as any)
    assert.equal(smsSent, false)

    // 2. Throws if code is issued but receptor is missing
    await assert.rejects(
      async () => {
        await sendOtpBeforeChange({
          data: { code: '1111' },
          originalDoc: { code: '2222' },
        } as any)
      },
      { message: /شماره همراه جهت ارسال کد تایید الزامی است/ }
    )

    // 3. Skips if code is unchanged
    smsSent = false
    await sendOtpBeforeChange({
      data: { code: '1111', phone: '09121112233' },
      originalDoc: { code: '1111' },
    } as any)
    assert.equal(smsSent, false)
  } finally {
    globalThis.fetch = origFetch
  }
})
