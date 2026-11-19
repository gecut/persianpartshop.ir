import assert from 'node:assert/strict'
import { test } from 'node:test'
import { maskPhone, maskEndpoint, sanitizeToken, normalizeReceptor } from './kavenegar-client'

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
