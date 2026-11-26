# QR Token Labels — Step-by-Step Plan for a Weaker Executor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **Do exactly what each step says. Do not improvise, rename, refactor, or "improve" anything that is not in the step.**

**Goal:** Replace the old per-product `scanCode` QR system with opaque, re-bindable tokens (CMS collection `qr-codes`). Customers who scan a label reach the public catalog page of the bound product. Staff with the web scanner get the same product-open behavior as today. The CMS exports print-ready PNG labels (exactly 60 mm × 80 mm) as a ZIP. Old data is cleaned up safely in two releases.

**Architecture:** CMS owns tokens (collection, generate, export, preview, search). One new CMS service operation `qr` on `POST /api/catalog/:operation` resolves a token. The public catalog app serves `/Q/<TOKEN>` and redirects to `/p/<id>`. The API gives staff `catalog.getByQrToken` and `catalog.listQrTokens`. The web scanner parses the token from the scanned URL; the offline package carries `token → productId`. The old DB column is dropped only in Release 2.

**Tech Stack:** Payload v3 + Next 16 (cms, catalog), Hono/oRPC on Bun (api), React 19 (web), Zod contract, `qrcode`, `sharp`, `fontkit`, `fflate`, hand-written Postgres migrations, `node:test` (cms/catalog) and `bun test` (api/web).

**Spec:** `docs/superpowers/specs/2026-11-26-qr-token-labels-design.md` (label artwork and reference renderer: `docs/superpowers/specs/qr-label-design-assets/`).

**Validation note:** every NEW test file and module in Tasks 2, 3, 5-pure parts, 6, 7 (pure helpers), 8 (`_selected-ids`), 9 (helpers), 10 (`qr-server`) and 11 (`qr-token`) was extracted from this document into a clean checkout and executed: all tests pass, and `tsc` reports no errors in the token/label modules. The edits to existing files are derived from a full implementation run whose gates (`check-types`, `test:unit`, web and catalog builds) passed.

## Rules for the executor (read first, obey always)

1. Work from the repository root `persianpartshop.ir/` unless a step says otherwise. Use `pnpm` only.
2. After **every** step that has a "Run" line, run it and compare with "Expected". If the result differs, **stop and fix that step** before moving on. Never skip a failing command.
3. TypeScript is strict: **no `any`**, no `@ts-ignore`. If `tsc` says a value is possibly `undefined`, handle it (`?? fallback`, an `if`, or `!` only where the line before proves it exists).
4. File names are kebab-case; components are PascalCase inside kebab-case files; named exports only; no `index.ts` barrel files (CMS collection folders already have their own `index.ts` — follow the one in `product-families/` exactly).
5. **Never** run `pnpm migrate`, `migrate:down`, or any command that connects to a real or production database. The only allowed DB commands are in Task 5, against the throwaway Docker container named there.
6. **Never** edit `.env*` files, `payload-types.ts` by hand (regenerate it), or `apps/web/src/routeTree.gen.ts`.
7. Do **not** run `git commit`, `git push`, or change branches. Leave all changes uncommitted. (Steps show a "Suggested commit message" only for the human.)
8. Do not touch Task 14 (Release 2) unless the human explicitly says so.
9. Persian copy must be copied character-for-character from this plan.
10. If something in this plan does not match the real code (a line number moved, a name differs), do not guess: search with `rg`, apply the same intent, and write one line about it in your final report.

## Global Constraints

- Token: 8 chars, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 symbols, no `0 1 I L O`), stored uppercase. Regex everywhere: `^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$` (in Zod: `/^[A-HJKMNP-Z2-9]{8}$/`).
- QR payload: `HTTPS://<CATALOG HOST>/Q/<TOKEN>`, entire string uppercase, error correction `H` (33×33 modules for this payload length). Catalog serves both `/Q/…` and `/q/…`.
- **Label PNG is exactly 60 mm × 80 mm: 2400 × 3200 px, 1016 dpi, opaque white, sRGB.** Brand red `#ae0f17`, data black `#14120f`, font `apps/cms/public/fonts/PEYDA-MEDIUM.TTF`.
- Label geometry (all in QR modules; 1 module ≈ 1.478 mm): cut line → border centerline `0.65`; border stroke `0.30`; **left/right gap between border-inner-edge and code = 3**; **top gap, code→caption gap and caption→bottom gap are equal to each other and are solved so the sticker is exactly 80 mm tall (≈ 4.3 modules)**; corner clip `2`; caption width = code width = 33 modules; two caption lines, gap between lines `1.2`; headline is `1.5×` the size of the sentence and is kashida-justified (`ـ`) to full width.
- Caption text (copy exactly): headline `قیمت و ویژگی‌های کالا` (contains a ZWNJ between `ی` and `ه`), sentence `برای مشاهدهٔ جزئیات کامل، اسکن کنید`.
- Only `manager` and `superadmin` admins create/update `qr-codes`; any authenticated admin (including `service`) reads; nobody deletes (`delete: () => false`).
- `canUseProductQr` (users) stays and still gates staff scanning. `products.scan_code` DB column stays in Release 1.
- Unbound / inactive / unknown / unpublished-product token → customer sees the Persian inactive page. One generic error code `QR_INACTIVE` (never reveal whether a token exists).

## Review Focus

- Token typed/scanned in lowercase, with whitespace, trailing slash, query or fragment must resolve like the canonical form (Tasks 2, 6, 10, 11).
- Unbound / inactive / unknown token or a token bound to a paused or unpublished product → friendly inactive page, never a 500 and never a leaked product (Tasks 6, 10).
- Old offline packages (shape `qr: {productId: scanCode}`) must not crash the web app: the API scope key changes so every client re-downloads once (Tasks 9, 11), and old data is never read as tokens.
- ZIP export with 0 ids, duplicate ids, missing ids, more than 500 ids, or by a non-manager fails cleanly or skips safely (Task 7).
- Re-binding a token to another product, or two tokens on one product, both work and reach staff after the offline package refresh (Tasks 4, 9, 12).

---

## File Structure

**Create (CMS):** `apps/cms/src/collections/qr-codes/{index.ts, qr-codes.collection.ts, _access.ts, _access.test.ts, _token.ts, _token.test.ts, _pick-tokens.ts, _pick-tokens.test.ts, _label.endpoints.ts, _label.endpoints.test.ts, components/qr-export.tsx, components/qr-preview.tsx, components/_selected-ids.ts, components/_selected-ids.test.ts}`; `apps/cms/src/modules/qr-label/{kashida.ts, kashida.test.ts, label-url.ts, label-url.test.ts, render-label.ts, render-label.test.ts}`; `apps/cms/src/modules/catalog/catalog-qr.ts` + `catalog-qr.test.ts`; `apps/cms/src/migrations/20261125_120000_qr_codes.ts`.
**Create (catalog):** `apps/catalog/src/app/q/[token]/page.tsx`, `apps/catalog/src/modules/qr/{qr-server.ts, qr-server.test.ts, _qr-inactive.tsx}`.
**Create (api):** `apps/api/src/routers/qr-token.helpers.ts`, `qr-token.helpers.test.ts`.
**Create (web):** `apps/web/src/modules/catalog/qr-token.ts`, `qr-token.test.ts`.
**Modify:** see each task. **Delete:** `apps/web/src/modules/products/product-qr-download.tsx`.

---

## Task 0: Baseline

- [ ] **Step 1:** Run `git status --porcelain` and write down the list. You must not touch files that were already modified before you began (they belong to someone else).
- [ ] **Step 2:** Run `pnpm install --frozen-lockfile`. Expected: `Done`.
- [ ] **Step 3:** Run `pnpm check-types`. Expected: finishes with no `error TS` lines.
- [ ] **Step 4:** Run `pnpm test:unit`. Expected: every workspace reports 0 failures. If any fails now, stop and report — do not continue.

---

## Task 1: Contract (`packages/contract`)

**Files:** modify `packages/contract/src/public-catalog.ts`, `packages/contract/src/catalog.ts`, `packages/contract/src/offline.ts`; test `packages/contract/src/public-catalog.test.ts`.

- [ ] **Step 1: Write the failing test.** Open `packages/contract/src/public-catalog.test.ts`. Directly below the existing `} from './public-catalog'` import line add this new import line (the file's imports are `node:assert/strict`, `node:test`'s `test`, and the `./public-catalog` list):

```ts
import { QrTokenSchema } from './catalog'
```

Then append at the end of the file:

```ts
test('qr operation accepts a token and returns a product id', () => {
  assert.equal(catalogOperations.qr.input.safeParse({ token: 'abcd2345' }).success, true)
  assert.equal(catalogOperations.qr.input.safeParse({ token: 'abc', extra: 1 }).success, false)
  assert.equal(catalogOperations.qr.output.safeParse({ productId: 7 }).success, true)
  assert.equal(catalogOperations.qr.output.safeParse({ productId: 0 }).success, false)
})

test('QrTokenSchema trims, uppercases and rejects ambiguous symbols', () => {
  assert.equal(QrTokenSchema.parse(' abcd2345 '), 'ABCD2345')
  assert.equal(QrTokenSchema.safeParse('ABCD2340').success, false) // contains 0
  assert.equal(QrTokenSchema.safeParse('ABCDEFGHI').success, false) // 9 chars
})
```
  (Use the file's existing assertion style: if it uses `assert` from `node:assert/strict` keep it; adapt names only.)
- [ ] **Step 2: Run** `pnpm --filter @persianpart/cms exec tsx --test ../../packages/contract/src/public-catalog.test.ts`. Expected: FAIL (`qr` is undefined / `QrTokenSchema` not exported).
- [ ] **Step 3: Edit `public-catalog.ts`.** Find the `catalogOperations` object (it ends with the `product:` entry, then `}`). Add a new entry after `product: { … },`:

```ts
  qr: {
    input: z.object({ token: z.string().max(64) }).strict(),
    output: z.object({ productId: z.number().int().positive() }).strict(),
  },
```
- [ ] **Step 4: Edit `catalog.ts`** (apply in this order, using `rg -n` to find each spot):
  1. In `CatalogProductSchema` (starts near `export const CatalogProductSchema = z.object({ id: EntityIdSchema,`) **delete** the line `  hasScanCode: z.boolean().optional(),`.
  2. Rename `ScannedCatalogProductSchema` → `CatalogProductDetailSchema` and type `ScannedCatalogProduct` → `CatalogProductDetail` (the comment above it may stay; change "returned by the scan endpoint" to "returned by catalog record endpoints"). Inside that schema **delete** the line `  hasScanCode: z.literal(true),`.
  3. Replace the whole `CatalogRecordSchema` definition with:

```ts
export const CatalogRecordSchema = CatalogProductDetailSchema.extend({
  createdAt: z.string(),
  familyId: z.number().int().positive().nullable().optional(),
})
```
  4. Just above `export const catalogContract = {` add:

```ts
export const QR_TOKEN_PATTERN = /^[A-HJKMNP-Z2-9]{8}$/
export const QrTokenSchema = z.string().trim().toUpperCase().regex(QR_TOKEN_PATTERN)
```
  5. In `catalogContract`: change `syncPage` to

```ts
  syncPage: oc.input(z.object({ cursor: z.string().max(2048).optional(), limit: z.number().int().min(1).max(100).default(24) }))
    .output(CatalogScopeOutputSchema.extend({ nextCursor: z.string().nullable() })),
```
  6. Replace the two procedures `getByScanCode` and `getProductQr` with:

```ts
  getByQrToken: oc
    .meta(openapi({ method: 'POST', path: '/catalog/qr', summary: 'شناسایی محصول با توکن QR' }))
    .input(z.object({ token: QrTokenSchema }))
    .output(CatalogRecordSchema),
  listQrTokens: oc
    .meta(openapi({ method: 'POST', path: '/catalog/qr-tokens', summary: 'فهرست توکن‌های QR مجاز برای اسکن آفلاین' }))
    .output(z.object({ tokens: z.record(QrTokenSchema, z.number().int().positive()) })),
```
- [ ] **Step 5: Edit `offline.ts`:** replace `qr: z.record(z.string()),` with `qr: z.record(QrTokenSchema, z.number().int().positive()).default({}),` and add `QrTokenSchema` to the existing import from `./catalog`.
- [ ] **Step 6: Run** the test from Step 2. Expected: PASS.
- [ ] **Step 7: Run** `pnpm --filter @persianpart/contract exec tsc --noEmit`. Expected: no errors in `packages/contract` itself. (Other packages will fail to compile until later tasks; that is expected now.)
- Suggested commit message: `feat(contract): add qr token shapes and drop scan code shapes`

---

## Task 2: Token module (CMS)

**Files:** create `apps/cms/src/collections/qr-codes/_token.ts`, `_token.test.ts`, `_pick-tokens.ts`, `_pick-tokens.test.ts`. Modify `apps/cms/package.json` (`test:unit` list).

- [ ] **Step 1: Write `_token.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { TOKEN_ALPHABET, generateToken, normalizeToken } from './_token'

test('generateToken uses only the safe alphabet and 8 characters', () => {
  for (let i = 0; i < 5000; i++) {
    const token = generateToken()
    assert.match(token, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
  }
  assert.equal(TOKEN_ALPHABET.length, 31)
})

test('generateToken is deterministic with an injected random source', () => {
  assert.equal(generateToken(() => 0), 'AAAAAAAA')
})

test('normalizeToken trims and uppercases, rejects anything else', () => {
  assert.equal(normalizeToken(' abcd2345\n'), 'ABCD2345')
  assert.equal(normalizeToken(' ab cd '), null)
  assert.equal(normalizeToken('ABCD2340'), null)
  assert.equal(normalizeToken(123), null)
  assert.equal(normalizeToken(undefined), null)
})
```
- [ ] **Step 2: Write `_pick-tokens.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { pickFreshTokens } from './_pick-tokens'

test('returns exactly count unique tokens', async () => {
  const tokens = await pickFreshTokens(50, async () => new Set())
  assert.equal(tokens.length, 50)
  assert.equal(new Set(tokens).size, 50)
})

test('replaces tokens that already exist', async () => {
  let first = true
  const tokens = await pickFreshTokens(3, async (candidates) => {
    if (!first) return new Set()
    first = false
    return new Set(candidates.slice(0, 1)) // pretend one candidate is taken
  })
  assert.equal(tokens.length, 3)
  assert.equal(new Set(tokens).size, 3)
})

test('gives up after too many collisions', async () => {
  await assert.rejects(() => pickFreshTokens(2, async (candidates) => new Set(candidates)), /تولید/)
})
```
- [ ] **Step 3: Run** `pnpm --filter @persianpart/cms exec tsx --test src/collections/qr-codes/_token.test.ts src/collections/qr-codes/_pick-tokens.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 4: Create `_token.ts`:**

```ts
import { randomInt } from 'node:crypto'

export const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const TOKEN_LENGTH = 8
const TOKEN_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/

export function generateToken(random: (max: number) => number = (max) => randomInt(max)): string {
  let token = ''
  for (let i = 0; i < TOKEN_LENGTH; i++) token += TOKEN_ALPHABET[random(TOKEN_ALPHABET.length)] ?? 'A'
  return token
}

export function normalizeToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const token = raw.trim().toUpperCase()
  return TOKEN_PATTERN.test(token) ? token : null
}
```
- [ ] **Step 5: Create `_pick-tokens.ts`:**

```ts
import { generateToken } from './_token'

/** `findExisting` returns the subset of `candidates` that already exist in the database. */
export async function pickFreshTokens(
  count: number,
  findExisting: (candidates: string[]) => Promise<Set<string>>,
): Promise<string[]> {
  const fresh = new Set<string>()
  for (let round = 0; round < 5 && fresh.size < count; round++) {
    const candidates = new Set<string>()
    while (candidates.size < count - fresh.size) {
      const token = generateToken()
      if (!fresh.has(token)) candidates.add(token)
    }
    const taken = await findExisting([...candidates])
    for (const token of candidates) if (!taken.has(token)) fresh.add(token)
  }
  if (fresh.size < count) throw new Error('تولید توکن یکتا ممکن نشد؛ دوباره تلاش کنید.')
  return [...fresh]
}
```
- [ ] **Step 6: Edit `apps/cms/package.json`:** in the `"test:unit"` script string, add these paths **inside the same string**, before `../../packages/contract/src/public-catalog.test.ts`: `src/collections/qr-codes/_token.test.ts src/collections/qr-codes/_pick-tokens.test.ts`.
- [ ] **Step 7: Run** the command from Step 3. Expected: all tests PASS.
- Suggested commit message: `feat(cms): add qr token generator`

---

## Task 3: Label renderer (pure module, exactly 60 × 80 mm)

**Files:** create `apps/cms/src/modules/qr-label/{kashida.ts, kashida.test.ts, label-url.ts, label-url.test.ts, render-label.ts, render-label.test.ts}`. Modify `apps/cms/package.json`, `apps/cms/next.config.ts`.

- [ ] **Step 1: Add dependencies.** Run:

```bash
pnpm --filter @persianpart/cms add qrcode fontkit fflate
pnpm --filter @persianpart/cms add -D @types/qrcode @types/fontkit jsqr
```
Expected: `package.json` and `pnpm-lock.yaml` change; `sharp` is already a dependency (do not add it again).
- [ ] **Step 2: Add the new tests to `test:unit`.** In `apps/cms/package.json` `test:unit`, add before the contract test path: `src/modules/qr-label/kashida.test.ts src/modules/qr-label/label-url.test.ts src/modules/qr-label/render-label.test.ts`.
- [ ] **Step 3: Write `label-url.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { labelUrl } from './label-url'

test('labelUrl is uppercase and uses the catalog origin only', () => {
  assert.equal(labelUrl('https://catalog.persianpartshop.ir/some/path', 'abcd2345'), 'HTTPS://CATALOG.PERSIANPARTSHOP.IR/Q/ABCD2345')
})

test('labelUrl rejects invalid tokens', () => {
  assert.throws(() => labelUrl('https://catalog.persianpartshop.ir', 'bad'), RangeError)
})
```
- [ ] **Step 4: Create `label-url.ts`:**

```ts
import { normalizeToken } from '../../collections/qr-codes/_token'

export function labelUrl(catalogUrl: string, token: string): string {
  const normalized = normalizeToken(token)
  if (!normalized) throw new RangeError('Invalid QR token')
  return `${new URL(catalogUrl).origin}/Q/${normalized}`.toUpperCase()
}
```
- [ ] **Step 5: Write `kashida.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { TATWEEL, justifyKashida } from './kashida'

const measure = (text: string) => text.length * 10

test('adds tatweels only between connectable letters and stretches toward the target', () => {
  const text = 'قیمت و کالا'
  const result = justifyKashida(text, 200, measure)
  assert.ok(result.includes(TATWEEL))
  assert.equal(result.replaceAll(TATWEEL, ''), text)
  assert.ok(measure(result) <= 240)
})

test('never places a tatweel after a right-joining letter or next to a space', () => {
  const result = justifyKashida('قیمت و کالا', 400, measure)
  for (const bad of ['ا', 'و', 'د', 'ر', 'ز', 'ژ', ' ']) assert.ok(!result.includes(bad + TATWEEL), bad)
  assert.ok(!result.includes(TATWEEL + ' '))
})

test('returns the input unchanged when it already fills the target', () => {
  assert.equal(justifyKashida('قیمت', 0, measure), 'قیمت')
})
```
- [ ] **Step 6: Create `kashida.ts`:**

```ts
export const TATWEEL = 'ـ'
// Letters that join to the NEXT letter (dual-joining).
const DUAL_JOIN = new Set([...'بپتثجچحخسشصضطظعغفقکگلمنهیئ'])
const isArabicLetter = (ch: string | undefined) => !!ch && /[ء-يٱ-ۓ]/.test(ch)

/**
 * Inserts at most one tatweel per word per round (mid-word first, longest words first) until the
 * measured width reaches `targetUnits`. `measure` returns the ink width of a string.
 */
export function justifyKashida(text: string, targetUnits: number, measure: (text: string) => number, tolerance = 40): string {
  const words = text.split(' ')
  const candidates = words.map((word) => {
    const positions: number[] = []
    for (let i = 0; i < word.length - 1; i++) {
      if (DUAL_JOIN.has(word[i] ?? '') && isArabicLetter(word[i + 1]) && word[i + 1] !== TATWEEL) positions.push(i + 1)
    }
    return positions.sort((a, b) => Math.abs(a - word.length / 2) - Math.abs(b - word.length / 2))
  })
  const adds: number[][] = words.map(() => [])
  const build = () =>
    words
      .map((word, wi) => {
        let out = ''
        for (let i = 0; i < word.length; i++) {
          out += word[i]
          out += TATWEEL.repeat((adds[wi] ?? []).filter((position) => position === i + 1).length)
        }
        return out
      })
      .join(' ')
  const order = [...words.keys()].sort((a, b) => (words[b]?.length ?? 0) - (words[a]?.length ?? 0))
  let best = text
  for (let round = 0; round < 6; round++) {
    for (const wi of order) {
      const options = candidates[wi] ?? []
      if (!options.length) continue
      const position = options[round % options.length]
      if (position === undefined) continue
      adds[wi]?.push(position)
      const next = build()
      if (measure(next) > targetUnits + tolerance) {
        adds[wi]?.pop()
        return best
      }
      best = next
    }
  }
  return best
}
```
- [ ] **Step 7: Write `render-label.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import jsQR from 'jsqr'
import sharp from 'sharp'
import { LABEL, renderLabel } from './render-label'

const url = 'HTTPS://CATALOG.PERSIANPARTSHOP.IR/Q/K7XP2MQA'

test('label is exactly 60 x 80 mm at 2400 x 3200 px, opaque sRGB', async () => {
  const { png, geometry } = await renderLabel(url)
  const meta = await sharp(png).metadata()
  assert.equal(meta.width, 2400)
  assert.equal(meta.height, 3200)
  assert.equal(meta.hasAlpha, false)
  assert.equal(meta.space, 'srgb')
  assert.equal(geometry.widthMm, 60)
  assert.ok(Math.abs(geometry.heightMm - 80) < 0.001)
})

test('side gap is 3 modules; top, code-to-caption and bottom gaps are equal', async () => {
  const { geometry } = await renderLabel(url)
  assert.ok(Math.abs(geometry.sideGap - LABEL.sideGap) < 1e-9)
  assert.ok(geometry.verticalGap >= geometry.sideGap)
  assert.ok(Math.abs(geometry.topGap - geometry.verticalGap) < 1e-9)
  assert.ok(Math.abs(geometry.captionGap - geometry.verticalGap) < 1e-9)
  assert.ok(Math.abs(geometry.bottomGap - geometry.verticalGap) < 1e-9)
})

test('the rendered PNG decodes to exactly the input URL', async () => {
  const { png } = await renderLabel(url)
  const { data, info } = await sharp(png).resize(800).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const decoded = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)
  assert.equal(decoded?.data, url)
})
```
- [ ] **Step 8: Create `render-label.ts`.** Copy exactly (this is a typed port of the approved design in `docs/superpowers/specs/qr-label-design-assets/reference-render-label.mjs`; keep every number):

```ts
import path from 'node:path'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { openSync, type Font } from 'fontkit'
import { justifyKashida } from './kashida'

export const LABEL = {
  widthMm: 60,
  heightMm: 80,
  pixelsPerMm: 40, // 2400 x 3200 px
  sideGap: 3, // modules, border inner edge -> code (left/right)
  border: 0.3, // modules
  cut: 0.65, // modules, cut line -> border centerline
  chamfer: 2, // modules
  captionWidth: 33, // modules, equals the code width
  lineGap: 1.2, // modules between the two caption lines
  headlineSize: 1.5, // headline = 1.5 x sentence
  headline: 'قیمت و ویژگی‌های کالا',
  sentence: 'برای مشاهدهٔ جزئیات کامل، اسکن کنید',
  red: '#ae0f17',
  black: '#14120f',
} as const

type Matrix = { size: number; get(row: number, col: number): number; isReserved(row: number, col: number): boolean }

let cachedFont: Font | undefined
function loadFont(): Font {
  cachedFont ??= openSync(path.join(process.cwd(), 'public/fonts/PEYDA-MEDIUM.TTF')) as Font
  return cachedFont
}
const shape = (text: string) => loadFont().layout(text, undefined, 'arab', 'FAR ', 'rtl')
const inkWidth = (text: string) => {
  const box = shape(text).bbox
  return box.maxX - box.minX
}

// --- QR geometry helpers (units: modules) ----------------------------------
const rect = (x: number, y: number, size: number) => `<rect x="${x}" y="${y}" width="${size}" height="${size}"/>`

function contour(x: number, y: number, w: number, [a, b, c, d]: [number, number, number, number]) {
  return `M${x + a} ${y}H${x + w - b}q${b} 0 ${b} ${b}V${y + w - c}q0 ${c} -${c} ${c}H${x + d}q-${d} 0 -${d} -${d}V${y + a}q0 -${a} ${a} -${a}Z`
}

/** Rounded "liquid" shape for one data module, joined to its neighbours. */
function liquidCell(x: number, y: number, on: (x: number, y: number) => boolean) {
  const neighbors = [on(x, y - 1), on(x + 1, y), on(x, y + 1), on(x - 1, y)]
  if (on(x, y)) {
    const radii = neighbors.map((v, i) => (v || neighbors[(i + 3) % 4] ? 0 : 0.43)) as [number, number, number, number]
    return contour(x, y, 1, radii)
  }
  let d = ''
  const corners: Array<[number, number, number, number, number]> = [
    [0, x, y, 1, 1],
    [1, x + 1, y, -1, 1],
    [2, x + 1, y + 1, -1, -1],
    [3, x, y + 1, 1, -1],
  ]
  for (const [i, cx, cy, sx, sy] of corners) {
    if (neighbors[i] && neighbors[(i + 3) % 4] && on(x - sx, y - sy)) {
      d += `M${cx} ${cy}h${sx * 0.32}q${-sx * 0.32} 0 ${-sx * 0.32} ${sy * 0.32}Z`
    }
  }
  return d
}

/** Octagonal finder eye (outer ring, white gap, solid centre). */
function finder(x: number, y: number, rotation: number) {
  let body = ''
  const rings: Array<[number, number, string]> = [
    [0, 7, 'currentColor'],
    [1, 5, 'white'],
    [2, 3, 'currentColor'],
  ]
  for (const [inset, w, fill] of rings) {
    const k = w * (inset === 2 ? 0.23 : 0.14)
    body += `<path transform="translate(${inset} ${inset})" fill="${fill}" d="M${k} 0H${w - k}L${w} ${k}V${w - k}L${w - k} ${w}H${k}L0 ${w - k}V${k}Z"/>`
  }
  return `<g transform="translate(${x} ${y}) rotate(${rotation} 3.5 3.5)">${body}</g>`
}

// --- Caption ---------------------------------------------------------------
function textLine(text: string, scale: number, centerX: number, topY: number) {
  const run = shape(text)
  const box = run.bbox
  const x = centerX - ((box.minX + box.maxX) * scale) / 2
  const baseline = topY + box.maxY * scale
  let cursor = 0
  const paths = run.glyphs.map((glyph, i) => {
    const pos = run.positions[i]
    const d = glyph.path.toSVG()
    const part = d && pos ? `<path transform="translate(${cursor + pos.xOffset} ${pos.yOffset})" d="${d}"/>` : ''
    if (pos) cursor += pos.xAdvance
    return part
  })
  return {
    svg: `<g fill="${LABEL.black}" transform="translate(${x} ${baseline}) scale(${scale} ${-scale})">${paths.join('')}</g>`,
    height: (box.maxY - box.minY) * scale,
  }
}

/** Two justified lines, both exactly `width` modules wide, drawn with their top edge at y = 0. */
function captionBlock(width: number, centerX: number) {
  const sentenceScale = width / inkWidth(LABEL.sentence)
  const headlineScale = sentenceScale * LABEL.headlineSize
  const headline = justifyKashida(LABEL.headline, width / headlineScale, inkWidth)
  const headlineFinal = width / inkWidth(headline) // tiny correction so the edges land exactly
  const a = textLine(headline, headlineFinal, centerX, 0)
  const b = textLine(LABEL.sentence, sentenceScale, centerX, a.height + LABEL.lineGap)
  return { svg: a.svg + b.svg, height: a.height + LABEL.lineGap + b.height }
}

// --- Layout ----------------------------------------------------------------
export interface LabelGeometry {
  widthMm: number
  heightMm: number
  sideGap: number
  verticalGap: number
  topGap: number
  captionGap: number
  bottomGap: number
}

export async function renderLabel(url: string): Promise<{ png: Buffer; geometry: LabelGeometry }> {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const matrix = modules as unknown as Matrix
  const n = matrix.size
  const innerPad = LABEL.cut + LABEL.border / 2 // cut line -> inner edge of the border ink
  const w = n + 2 * (innerPad + LABEL.sideGap)
  const mmPerModule = LABEL.widthMm / w
  const h = LABEL.heightMm / mmPerModule
  const caption = captionBlock(LABEL.captionWidth, w / 2)
  const verticalGap = (h - (2 * innerPad + n + caption.height)) / 3
  if (verticalGap < LABEL.sideGap) throw new RangeError('Label content does not fit 60 x 80 mm')
  const qx = innerPad + LABEL.sideGap
  const qy = innerPad + verticalGap
  const captionTop = qy + n + verticalGap

  const a = LABEL.cut
  const b = w - a
  const z = h - a
  const k = LABEL.chamfer
  const border = `<path fill="none" stroke="${LABEL.red}" stroke-width="${LABEL.border}" stroke-linejoin="round" d="M${a + k} ${a}H${b - k}l${k} ${k}V${z - k}l-${k} ${k}H${a + k}l-${k} -${k}V${a + k}Z"/>`

  const eyes: Array<[number, number, number]> = [[0, 0, 0], [n - 7, 0, 90], [0, n - 7, -90]]
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && matrix.get(y, x) === 1
  let squares = ''
  let liquid = ''
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (eyes.some(([ex, ey]) => x >= ex && x < ex + 7 && y >= ey && y < ey + 7)) continue
      if (!matrix.isReserved(y, x)) liquid += liquidCell(x, y, on)
      else if (on(x, y)) squares += rect(x, y, 1)
    }
  }
  const code = `<g transform="translate(${qx} ${qy})"><g color="${LABEL.black}" fill="${LABEL.black}">${squares}<path d="${liquid}"/></g><g color="${LABEL.red}">${eyes.map(([x, y, r]) => finder(x, y, r)).join('')}</g></g>`
  const widthPx = LABEL.widthMm * LABEL.pixelsPerMm
  const heightPx = LABEL.heightMm * LABEL.pixelsPerMm
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="white"/>${border}${code}<g transform="translate(0 ${captionTop})">${caption.svg}</g></svg>`
  const png = await sharp(Buffer.from(svg))
    .flatten({ background: 'white' })
    .removeAlpha()
    .withIccProfile('srgb')
    .withMetadata({ density: Math.round(LABEL.pixelsPerMm * 25.4) })
    .png()
    .toBuffer()
  return {
    png,
    geometry: {
      widthMm: LABEL.widthMm,
      heightMm: h * mmPerModule,
      sideGap: LABEL.sideGap,
      verticalGap,
      topGap: qy - innerPad,
      captionGap: captionTop - (qy + n),
      bottomGap: h - innerPad - (captionTop + caption.height),
    },
  }
}
```
  Notes for you: `QRCode.create` has no `maskPattern` argument here on purpose (auto mask). If `tsc` complains that `Font` has no `layout`/`bbox`, it means `fontkit` resolved to a collection type — keep the `as Font` cast; do not use `any`.
- [ ] **Step 9: Run** `pnpm --filter @persianpart/cms exec tsx --test src/modules/qr-label/kashida.test.ts src/modules/qr-label/label-url.test.ts src/modules/qr-label/render-label.test.ts`. Expected: all PASS. If the decode test fails, do **not** loosen it: re-check that you copied the numbers exactly (`sideGap 3`, `chamfer 2`, octagon `0.14/0.23`, liquid radius `0.43`).
- [ ] **Step 10: Visual check.** Run:

```bash
cd apps/cms && node --import tsx -e "import('./src/modules/qr-label/render-label.ts').then(async m => { const r = await m.renderLabel('HTTPS://CATALOG.PERSIANPARTSHOP.IR/Q/K7XP2MQA'); await (await import('node:fs/promises')).writeFile('/tmp/label-check.png', r.png); console.log(r.geometry) })"; cd -
```
  Expected: prints geometry with `widthMm: 60`, `heightMm` ≈ `80`, `sideGap: 3`, the three vertical gaps ≈ `4.3`. Open `/tmp/label-check.png` and compare with `docs/superpowers/specs/qr-label-design-assets/approved-template-60x80mm.png`: red octagonal eyes, black liquid data, thin red clipped border, two Persian lines with connected letters.
- [ ] **Step 11: Configure Next for sharp/fontkit/font.** Edit `apps/cms/next.config.ts`: inside `const nextConfig: NextConfig = {` add two properties right after `agentRules: false,`:

```ts
  serverExternalPackages: ['sharp', 'fontkit'],
  outputFileTracingIncludes: {
    '/api/**': ['./public/fonts/PEYDA-MEDIUM.TTF'],
  },
```
- [ ] **Step 12: Run** `pnpm --filter @persianpart/cms exec tsc --noEmit`. Expected: no new errors from `qr-label`.
- Suggested commit message: `feat(cms): add 60x80 mm qr label renderer`

---

## Task 4: `qr-codes` collection

**Files:** create `apps/cms/src/collections/qr-codes/{_access.ts, _access.test.ts, qr-codes.collection.ts, index.ts}`. Modify `apps/cms/src/payload.config.ts`, `apps/cms/src/lib/protect-relations.ts`, `apps/cms/src/collections/products/products.collection.ts`, `apps/cms/src/modules/catalog/catalog-mapper.test.ts`, `apps/cms/package.json`; regenerate `apps/cms/src/payload-types.ts`.

- [ ] **Step 1: Write `_access.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import type { PayloadRequest } from 'payload'
import { canManageQr } from './_access'

const req = (user: unknown) => ({ user }) as unknown as PayloadRequest
const admin = (role: string, extra: object = {}) => ({ collection: 'admins', role, isActive: true, ...extra })

test('only active managers and superadmins manage qr codes', () => {
  assert.equal(canManageQr(req(admin('manager'))), true)
  assert.equal(canManageQr(req(admin('superadmin'))), true)
  for (const role of ['editor', 'support', 'service']) assert.equal(canManageQr(req(admin(role))), false, role)
  assert.equal(canManageQr(req(admin('manager', { isActive: false }))), false)
  assert.equal(canManageQr(req({ collection: 'users', role: 'manager' })), false)
  assert.equal(canManageQr(req(null)), false)
})
```
- [ ] **Step 2: Run** `pnpm --filter @persianpart/cms exec tsx --test src/collections/qr-codes/_access.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Create `_access.ts`:**

```ts
import type { Access, PayloadRequest } from 'payload'
import { getAdminUser } from '../../access/roles'

export const canManageQr = (req: PayloadRequest): boolean => {
  const user = getAdminUser(req.user)
  return Boolean(user && user.isActive !== false && (user.role === 'manager' || user.role === 'superadmin'))
}
export const isQrManager: Access = ({ req }) => canManageQr(req)
```
- [ ] **Step 4: Create `qr-codes.collection.ts`:**

```ts
import type { CollectionConfig } from 'payload'
import { isAdminAuthenticated } from '../../access/roles'
import { isQrManager } from './_access'
import { generateToken, normalizeToken } from './_token'
import { qrLabelEndpoints } from './_label.endpoints'

export const QrCodes: CollectionConfig = {
  slug: 'qr-codes',
  labels: { singular: 'کد QR', plural: 'کدهای QR' },
  admin: {
    useAsTitle: 'token',
    group: 'محصولات و کاتالوگ',
    defaultColumns: ['token', 'product', 'store', 'isActive'],
    listSearchableFields: ['token', 'store', 'note'],
    components: {
      beforeListTable: ['/collections/qr-codes/components/qr-export#QrExport'],
    },
  },
  endpoints: qrLabelEndpoints,
  access: {
    read: isAdminAuthenticated,
    create: isQrManager,
    update: isQrManager,
    delete: () => false,
  },
  fields: [
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      maxLength: 8,
      label: 'توکن',
      access: { update: () => false },
      admin: { readOnly: true, description: 'توکن به‌صورت خودکار ساخته می‌شود و تغییر نمی‌کند.' },
      hooks: {
        beforeValidate: [
          ({ value, operation }) => {
            if (operation === 'create' && (typeof value !== 'string' || !value.trim())) return generateToken()
            return typeof value === 'string' ? (normalizeToken(value) ?? value.trim().toUpperCase()) : value
          },
        ],
      },
      validate: (value: string | null | undefined) =>
        normalizeToken(value) ? true : 'توکن باید ۸ نویسهٔ لاتین بزرگ یا رقم (بدون 0، 1، I، L، O) باشد.',
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      index: true,
      maxDepth: 0,
      label: 'محصول متصل',
      admin: { description: 'خالی بگذارید تا کد فعلاً بدون محصول بماند. هر زمان می‌توانید محصول را عوض کنید.' },
    },
    { name: 'store', type: 'text', maxLength: 120, label: 'فروشگاه / محل نصب' },
    { name: 'note', type: 'textarea', label: 'یادداشت' },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'فعال',
      admin: { description: 'با غیرفعال‌کردن، اسکن این کد برای مشتری «کد فعال نیست» نشان می‌دهد.' },
    },
    {
      name: 'labelPreview',
      type: 'ui',
      admin: { components: { Field: '/collections/qr-codes/components/qr-preview#QrPreview' } },
    },
  ],
}
```
  (It imports `_label.endpoints` which you create in Task 7. For now create that file with the minimal stub below so this task compiles; Task 7 replaces it.)
  Create `_label.endpoints.ts` stub:

```ts
import type { Endpoint } from 'payload'

export const qrLabelEndpoints: Endpoint[] = []
```
  Also create the two component files as temporary stubs so the import-map step does not fail later: `components/qr-export.tsx` → `'use client'\nexport function QrExport() { return null }` and `components/qr-preview.tsx` → `'use client'\nexport function QrPreview() { return null }` (Task 8 replaces both).
- [ ] **Step 5: Create `index.ts`:** `export { QrCodes } from './qr-codes.collection'` (same one-line style as `collections/product-families/index.ts`).
- [ ] **Step 6: Register in `payload.config.ts`.** Add next to the `ProductFamilies` import: `import { QrCodes } from './collections/qr-codes'`. In the `collections: addMcpWriteGuards(protectBusinessRelations([` list, add `QrCodes,` on the line right after `ProductFamilies,`.
- [ ] **Step 7: Edit `lib/protect-relations.ts`:** in the `referenceActions` object add one entry after `'products.family': …,`:

```ts
  'qr-codes.product': 'ابتدا کدهای QR متصل به این محصول را به محصول دیگری وصل کنید یا غیرفعال کنید.',
```
- [ ] **Step 8: Remove `scanCode` from products.** In `collections/products/products.collection.ts` delete the whole field object whose `name: "scanCode"` (from `{` before `name: "scanCode"` to its closing `},`, about 8 lines, in the "پیشرفته" tab right after `slug`). Then run `rg -n "getAdminUser" apps/cms/src/collections/products/products.collection.ts`; if it is no longer used anywhere in that file, remove it from the import line, otherwise leave it.
- [ ] **Step 9: Fix the mapper test.** In `apps/cms/src/modules/catalog/catalog-mapper.test.ts` delete line `  scanCode: 'INTERNAL-SECRET',` (the product fixture). Keep the `'scanCode',` entry in the forbidden-keys list (it is a negative assertion).
- [ ] **Step 10: Add `_access.test.ts` to `test:unit`** (same string, before the contract test path): `src/collections/qr-codes/_access.test.ts`.
- [ ] **Step 11: Regenerate types:** `pnpm --filter @persianpart/cms generate:types`. Expected: `payload-types.ts` now has `QrCode` and no `scanCode` in `Product`.
- [ ] **Step 12: Run** `pnpm --filter @persianpart/cms exec tsx --test src/collections/qr-codes/_access.test.ts` (Expected PASS) and `pnpm --filter @persianpart/cms exec tsc --noEmit` (Expected: errors only in files you have not reached yet — API/web are separate packages so CMS should be clean; fix any CMS error before continuing).
- Suggested commit message: `feat(cms): add qr-codes collection`

---

## Task 5: Expand migration (additive only)

**Files:** create `apps/cms/src/migrations/20261125_120000_qr_codes.ts`; modify `apps/cms/src/migrations/index.ts`.

- [ ] **Step 1: Look at the model** `apps/cms/src/migrations/20261121_120000_product_families.ts` (read it fully; copy its style for the FK `DO $$ … EXCEPTION WHEN duplicate_object` block and the `payload_locked_documents_rels` part).
- [ ] **Step 2: Create `20261125_120000_qr_codes.ts`:**

```ts
import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// Expand step only: adds qr_codes. It never alters, drops or updates an existing column or row.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "qr_codes" (
      "id" serial PRIMARY KEY NOT NULL,
      "token" varchar NOT NULL,
      "product_id" integer,
      "store" varchar,
      "note" varchar,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "qr_codes_token_idx" ON "qr_codes" USING btree ("token");
    CREATE INDEX IF NOT EXISTS "qr_codes_product_idx" ON "qr_codes" USING btree ("product_id");
    CREATE INDEX IF NOT EXISTS "qr_codes_updated_at_idx" ON "qr_codes" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "qr_codes_created_at_idx" ON "qr_codes" USING btree ("created_at");
    DO $$ BEGIN
      ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "qr_codes_id" integer;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_qr_codes_id_idx"
      ON "payload_locked_documents_rels" USING btree ("qr_codes_id");
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_qr_codes_fk"
        FOREIGN KEY ("qr_codes_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    INSERT INTO "offline_source_revision" ("source") VALUES ('qr_codes') ON CONFLICT DO NOTHING;
    DROP TRIGGER IF EXISTS mark_offline_source_changed ON "qr_codes";
    CREATE TRIGGER mark_offline_source_changed
      AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON "qr_codes"
      FOR EACH STATEMENT EXECUTE FUNCTION mark_offline_source_changed();
  `)
}

// For local rehearsal only. This drops qr token data; never run it operationally.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS mark_offline_source_changed ON "qr_codes";
    DELETE FROM "offline_source_revision" WHERE "source" = 'qr_codes';
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_qr_codes_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_qr_codes_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "qr_codes_id";
    DROP TABLE IF EXISTS "qr_codes";
  `)
}
```
  Why the `offline_source_revision` insert matters: the API builds the offline snapshot cache key from **all** rows of that table, so adding a row makes every stored offline snapshot rebuild automatically. Do not remove it.
- [ ] **Step 3: Register it.** In `apps/cms/src/migrations/index.ts` add at the end of the imports `import * as qrCodes from './20261125_120000_qr_codes'` and add as the **last** entry of the `migrations` array: `{ up: qrCodes.up, down: qrCodes.down, name: '20261125_120000_qr_codes' },` (match the formatting of the line above it).
- [ ] **Step 4: Run** `pnpm --filter @persianpart/cms exec tsc --noEmit`. Expected: clean.
- [ ] **Step 5: Rehearse on a THROWAWAY database (mandatory; this is the only place a DB command is allowed).**

```bash
docker run -d --name pp-mig -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16
sleep 5
# load a COPY of the data. Ask the human for a dump file path; if none exists, run only the empty-schema rehearsal:
DATABASE_URL=postgresql://postgres:x@localhost:55432/postgres pnpm --filter @persianpart/cms migrate
DATABASE_URL=postgresql://postgres:x@localhost:55432/postgres pnpm --filter @persianpart/cms migrate
psql postgresql://postgres:x@localhost:55432/postgres -c '\d qr_codes' -c "select count(*) from offline_source_revision where source='qr_codes'" -c "select count(scan_code) from products"
```
  Expected: the second `migrate` finds nothing to do; `\d qr_codes` shows the table, 3 indexes + unique index, FK to `products`, trigger `mark_offline_source_changed`; the count query returns `1`; `products.scan_code` column still exists. If you were given a dump, also record `select count(*)` of `products`, `users`, `orders`, `plans`, `warehouse_stock` before and after — they must match. When done: `docker rm -f pp-mig`.
- Suggested commit message: `feat(cms): add qr_codes expand migration`

---

## Task 6: CMS `qr` operation (resolve token → product id)

**Files:** create `apps/cms/src/modules/catalog/catalog-qr.ts`, `catalog-qr.test.ts`; modify `apps/cms/src/modules/catalog/catalog-service.ts`, `apps/cms/src/endpoints/catalog.endpoint.ts`, `apps/cms/package.json`.

- [ ] **Step 1: Write `catalog-qr.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveQr, type QrDeps } from './catalog-qr'

const row = { product: 7, isActive: true as boolean | null | undefined }
const deps = (over: Partial<QrDeps> = {}): QrDeps => ({
  findByToken: async (token) => (token === 'ABCD2345' ? row : null),
  isPublished: async (id) => id === 7,
  ...over,
})
const inactive = (error: unknown) => (error as { status?: number; data?: { code?: string } }).status === 404 &&
  (error as { data?: { code?: string } }).data?.code === 'QR_INACTIVE'

test('active bound published token resolves, in any case and with spaces', async () => {
  assert.deepEqual(await resolveQr(deps(), 'abcd2345'), { productId: 7 })
  assert.deepEqual(await resolveQr(deps(), '  ABCD2345 '), { productId: 7 })
})

test('unknown, malformed, inactive, unbound and unpublished all fail the same way', async () => {
  for (const [d, token] of [
    [deps(), 'ZZZZ2222'],
    [deps(), 'bad'],
    [deps(), '../../etc'],
    [deps(), 'x'.repeat(5000)],
    [deps({ findByToken: async () => ({ product: 7, isActive: false }) }), 'ABCD2345'],
    [deps({ findByToken: async () => ({ product: null, isActive: true }) }), 'ABCD2345'],
    [deps({ isPublished: async () => false }), 'ABCD2345'],
  ] as const) {
    await assert.rejects(() => resolveQr(d, token), inactive)
  }
})

test('malformed tokens never reach the database', async () => {
  let calls = 0
  await assert.rejects(() => resolveQr(deps({ findByToken: async () => { calls++; return null } }), 'nope'), inactive)
  assert.equal(calls, 0)
})
```
- [ ] **Step 2: Run** `pnpm --filter @persianpart/cms exec tsx --test src/modules/catalog/catalog-qr.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Create `catalog-qr.ts`:**

```ts
import { APIError } from 'payload'
import { normalizeToken } from '../../collections/qr-codes/_token'

export interface QrRow {
  product: number | { id: number } | null | undefined
  isActive: boolean | null | undefined
}
export interface QrDeps {
  findByToken(token: string): Promise<QrRow | null>
  isPublished(productId: number): Promise<boolean>
}

const inactive = () => new APIError('کد QR فعال نیست.', 404, { code: 'QR_INACTIVE' })

export async function resolveQr(deps: QrDeps, rawToken: string): Promise<{ productId: number }> {
  const token = normalizeToken(rawToken)
  if (!token) throw inactive()
  const row = await deps.findByToken(token)
  if (!row || row.isActive === false) throw inactive()
  const productId = typeof row.product === 'object' && row.product ? row.product.id : row.product
  if (typeof productId !== 'number' || !(await deps.isPublished(productId))) throw inactive()
  return { productId }
}
```
- [ ] **Step 4: Wire into the service.** In `catalog-service.ts`: add imports `import { resolveQr } from './catalog-qr'`. In the object returned by `createCatalogService` (the one with `bootstrap`, `browse`, `product`, `preview`), add a new member after `product: async (...) => { ... },`:

```ts
    qr: async (input: CatalogInput<'qr'>) => {
      const { settings } = await loadSettings()
      return resolveQr(
        {
          findByToken: async (token) => {
            const result = await req.payload.find({
              collection: 'qr-codes',
              where: { token: { equals: token } },
              limit: 1,
              depth: 0,
              req,
              overrideAccess: false,
            })
            return result.docs[0] ?? null
          },
          isPublished: async (productId) => {
            if (settings.paused) return false
            const data = await query({ policy: compilePolicy(settings), mode: 'browse', productId, limit: 1 })
            return data.rows.length > 0
          },
        },
        input.token,
      )
    },
```
- [ ] **Step 5: Wire the endpoint.** In `catalog.endpoint.ts` add a new `case` before `default:`:

```ts
        case 'qr': {
          const input = catalogOperations.qr.input.safeParse(body)
          if (!input.success) throw new APIError('درخواست معتبر نیست.', 400)
          return Response.json(
            catalogOperations.qr.output.parse(await service.qr(input.data)),
            { headers: { 'Cache-Control': 'private, no-store' } },
          )
        }
```
- [ ] **Step 6: Add the test to `test:unit`:** `src/modules/catalog/catalog-qr.test.ts`.
- [ ] **Step 7: Run** `pnpm --filter @persianpart/cms exec tsx --test src/modules/catalog/catalog-qr.test.ts` (Expected PASS), then `pnpm --filter @persianpart/cms test:unit` (Expected 0 failures) and `pnpm --filter @persianpart/cms exec tsc --noEmit` (Expected clean).
- Suggested commit message: `feat(cms): add qr resolve operation`

---

## Task 7: Label endpoints (generate, export ZIP, preview)

**Files:** replace stub `apps/cms/src/collections/qr-codes/_label.endpoints.ts`; create `_label.endpoints.test.ts`; modify `apps/cms/package.json`.

- [ ] **Step 1: Write `_label.endpoints.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { unzipSync } from 'fflate'
import { buildZip, parseExportBody, parseGenerateBody, zipEntryName } from './_label.endpoints'

test('parseGenerateBody validates count and store', () => {
  for (const bad of [{ count: 0 }, { count: 501 }, { count: 1.5 }, { count: '3' }, {}, null, 'x'])
    assert.equal(parseGenerateBody(bad), null, JSON.stringify(bad))
  assert.deepEqual(parseGenerateBody({ count: 100, store: ' فروشگاه ۱ ' }), { count: 100, store: 'فروشگاه ۱' })
  assert.deepEqual(parseGenerateBody({ count: 2 }), { count: 2, store: null })
  assert.equal(parseGenerateBody({ count: 2, store: 'x'.repeat(121) }), null)
})

test('parseExportBody validates, de-duplicates and caps ids', () => {
  assert.equal(parseExportBody({ ids: [] }), null)
  assert.equal(parseExportBody({ ids: Array.from({ length: 501 }, (_, i) => i + 1) }), null)
  assert.equal(parseExportBody({ ids: ['a'] }), null)
  assert.equal(parseExportBody({ ids: [0] }), null)
  assert.deepEqual(parseExportBody({ ids: [3, 3, 4] }), [3, 4])
})

test('zipEntryName is safe', () => {
  assert.equal(zipEntryName(null, 'ABCD2345'), 'qr-ABCD2345.png')
  assert.equal(zipEntryName('../etc/x', 'ABCD2345'), 'etc-x-ABCD2345.png')
  assert.ok(!/[\\/]|\.\./.test(zipEntryName('a/b\\c..d', 'ABCD2345')))
})

test('buildZip round-trips names and bytes', () => {
  const zip = buildZip([{ name: 'a.png', png: new Uint8Array([1, 2, 3]) }, { name: 'b.png', png: new Uint8Array([4]) }])
  const files = unzipSync(zip)
  assert.deepEqual(Object.keys(files).sort(), ['a.png', 'b.png'])
  assert.deepEqual([...(files['a.png'] ?? [])], [1, 2, 3])
})
```
- [ ] **Step 2: Run** `pnpm --filter @persianpart/cms exec tsx --test src/collections/qr-codes/_label.endpoints.test.ts`. Expected: FAIL (functions missing).
- [ ] **Step 3: Replace `_label.endpoints.ts`:**

```ts
import { initTransaction, commitTransaction, killTransaction, type Endpoint, type PayloadRequest } from 'payload'
import { zipSync } from 'fflate'
import { getAdminUser } from '../../access/roles'
import { renderLabel } from '../../modules/qr-label/render-label'
import { labelUrl } from '../../modules/qr-label/label-url'
import { canManageQr } from './_access'
import { pickFreshTokens } from './_pick-tokens'

const MAX_COUNT = 500
const forbidden = () => Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
const bad = (error: string, status = 400) => Response.json({ error }, { status })

export function parseGenerateBody(body: unknown): { count: number; store: string | null } | null {
  if (!body || typeof body !== 'object') return null
  const { count, store } = body as Record<string, unknown>
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_COUNT) return null
  if (store !== undefined && store !== null && typeof store !== 'string') return null
  const trimmed = typeof store === 'string' ? store.trim() : ''
  if (trimmed.length > 120) return null
  return { count, store: trimmed || null }
}

export function parseExportBody(body: unknown): number[] | null {
  if (!body || typeof body !== 'object') return null
  const { ids } = body as Record<string, unknown>
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_COUNT) return null
  if (!ids.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) return null
  return [...new Set(ids as number[])]
}

export function zipEntryName(store: string | null | undefined, token: string): string {
  const safe = (store ?? '')
    .replace(/\.\./g, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()
  return `${safe || 'qr'}-${token}.png`
}

export function buildZip(entries: { name: string; png: Uint8Array }[]): Uint8Array {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {}
  for (const entry of entries) files[entry.name] = [entry.png, { level: 0 }] // PNG is already compressed
  return zipSync(files)
}

const catalogUrl = () => process.env.CATALOG_URL ?? ''

async function renderToken(token: string) {
  return (await renderLabel(labelUrl(catalogUrl(), token))).png
}

const generate: Endpoint = {
  path: '/generate',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!canManageQr(req)) return forbidden()
    const input = parseGenerateBody(await req.json?.().catch(() => undefined))
    if (!input) return bad('تعداد یا نام فروشگاه معتبر نیست.')
    const transaction = await initTransaction(req)
    try {
      const tokens = await pickFreshTokens(input.count, async (candidates) => {
        const found = await req.payload.find({
          collection: 'qr-codes', where: { token: { in: candidates } }, limit: candidates.length,
          depth: 0, pagination: false, req, overrideAccess: false,
        })
        return new Set(found.docs.map((doc) => doc.token))
      })
      const ids: number[] = []
      for (const token of tokens) {
        const doc = await req.payload.create({
          collection: 'qr-codes', data: { token, store: input.store, isActive: true }, req, overrideAccess: false,
        })
        ids.push(doc.id)
      }
      if (transaction) await commitTransaction(req)
      return Response.json({ ids })
    } catch (error) {
      if (transaction) await killTransaction(req)
      req.payload.logger.error({ msg: 'QR generate failed', error: error instanceof Error ? error.message : 'unknown' })
      return bad('ساخت کدها ممکن نشد؛ دوباره تلاش کنید.', 500)
    }
  },
}

const exportZip: Endpoint = {
  path: '/export',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!canManageQr(req)) return forbidden()
    if (!catalogUrl()) return bad('آدرس کاتالوگ تنظیم نشده است.', 500)
    const ids = parseExportBody(await req.json?.().catch(() => undefined))
    if (!ids) return bad(`شناسه‌ها معتبر نیست؛ حداکثر ${MAX_COUNT} کد در هر خروجی مجاز است.`)
    const found = await req.payload.find({
      collection: 'qr-codes', where: { id: { in: ids } }, limit: ids.length, depth: 0, pagination: false, req, overrideAccess: false,
    })
    if (!found.docs.length) return bad('کدی با این شناسه‌ها پیدا نشد.', 404)
    const entries: { name: string; png: Uint8Array }[] = []
    for (const doc of found.docs) entries.push({ name: zipEntryName(doc.store, doc.token), png: await renderToken(doc.token) })
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    return new Response(buildZip(entries) as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="qr-labels-${stamp}.zip"`,
        'Cache-Control': 'private, no-store',
      },
    })
  },
}

const preview: Endpoint = {
  path: '/preview',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    if (!getAdminUser(req.user)) return forbidden()
    if (!catalogUrl()) return bad('آدرس کاتالوگ تنظیم نشده است.', 500)
    const id = Number(new URL(req.url ?? 'http://localhost').searchParams.get('id'))
    if (!Number.isInteger(id) || id < 1) return bad('شناسه معتبر نیست.')
    const doc = await req.payload.findByID({ collection: 'qr-codes', id, depth: 0, req, overrideAccess: false }).catch(() => null)
    if (!doc) return bad('کد پیدا نشد.', 404)
    return new Response((await renderToken(doc.token)) as unknown as BodyInit, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' },
    })
  },
}

export const qrLabelEndpoints: Endpoint[] = [generate, exportZip, preview]
```
- [ ] **Step 4: Add the test to `test:unit`:** `src/collections/qr-codes/_label.endpoints.test.ts`.
- [ ] **Step 5: Run** the test from Step 2 (Expected PASS), then `pnpm --filter @persianpart/cms exec tsc --noEmit` (Expected clean). If `tsc` complains about `BodyInit`, replace the cast with `as unknown as ConstructorParameters<typeof Response>[0]`.
- Suggested commit message: `feat(cms): add qr label generate, export and preview endpoints`

---

## Task 8: Admin UI (generate, export selected, preview, search)

**Files:** replace stubs `components/qr-export.tsx`, `components/qr-preview.tsx`; create `components/_selected-ids.ts`, `components/_selected-ids.test.ts`; modify `qr-codes.collection.ts`, `apps/cms/package.json`; regenerate `apps/cms/src/app/(payload)/admin/importMap.js`.

- [ ] **Step 1 (read-only spike).** Run `rg -n "useSelection" apps/cms/node_modules/@payloadcms/ui/dist --glob "*.d.ts" | head`, open the `.d.ts` that declares it, and write down the exact shape of its return value (field that holds selected ids). Expected: an object with a `selected` field (a `Map` of id → boolean in Payload 3.x). Use the real shape you found in Step 4; do not guess.
- [ ] **Step 2: Write `_selected-ids.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectedIds } from './_selected-ids'

test('keeps only selected numeric ids, de-duplicated', () => {
  const selected = new Map<string | number, boolean>([[1, true], ['2', true], [3, false], ['x', true], [1, true]])
  assert.deepEqual(selectedIds(selected), [1, 2])
})
test('empty selection gives an empty list', () => assert.deepEqual(selectedIds(new Map()), []))
```
- [ ] **Step 3: Create `_selected-ids.ts`:**

```ts
export function selectedIds(selected: ReadonlyMap<string | number, boolean>): number[] {
  const ids = new Set<number>()
  for (const [key, isSelected] of selected) {
    const id = Number(key)
    if (isSelected && Number.isInteger(id) && id > 0) ids.add(id)
  }
  return [...ids]
}
```
  Add `src/collections/qr-codes/components/_selected-ids.test.ts` to `test:unit`. Run `pnpm --filter @persianpart/cms exec tsx --test src/collections/qr-codes/components/_selected-ids.test.ts` — Expected PASS.
- [ ] **Step 4: Replace `components/qr-export.tsx`:**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelection } from '@payloadcms/ui'
import { selectedIds } from './_selected-ids'

const box = { display: 'grid', gap: 12, padding: 16, marginBottom: 16, border: '1px solid var(--theme-elevation-150)', borderRadius: 8 } as const
const row = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } as const

export function QrExport() {
  const router = useRouter()
  const { selected } = useSelection()
  const [count, setCount] = useState(10)
  const [store, setStore] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const ids = selectedIds(selected)

  async function generate() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/qr-codes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count, store }),
      })
      const data = (await response.json().catch(() => ({}))) as { ids?: number[]; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'ساخت کدها ممکن نشد.')
      setMessage(`${data.ids?.length ?? 0} کد جدید ساخته شد.`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ساخت کدها ممکن نشد.')
    } finally { setBusy(false) }
  }

  async function exportZip() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/qr-codes/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'دریافت خروجی ممکن نشد.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'qr-labels.zip'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت خروجی ممکن نشد.')
    } finally { setBusy(false) }
  }

  return (
    <section dir="rtl" style={box} aria-label="ساخت و دریافت کدهای QR">
      <div style={row}>
        <label>تعداد <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
        <label>فروشگاه / محل <input type="text" maxLength={120} value={store} onChange={(e) => setStore(e.target.value)} /></label>
        <button type="button" className="btn btn--style-primary btn--size-small" disabled={busy || count < 1 || count > 500} onClick={() => void generate()}>ساخت کدهای جدید</button>
      </div>
      <div style={row}>
        <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy || ids.length === 0} onClick={() => void exportZip()}>
          دریافت خروجی QR (ZIP) — {ids.length} کد انتخاب‌شده
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
```
  If the shape you found in Step 1 is not a `Map` named `selected`, adapt only the line `const { selected } = useSelection()` and the argument to `selectedIds` (convert to a `Map<string | number, boolean>` first).
- [ ] **Step 5: Replace `components/qr-preview.tsx`:**

```tsx
'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'

export function QrPreview() {
  const { id } = useDocumentInfo()
  const token = useField<string>({ path: 'token' }).value
  if (!id) return <p dir="rtl">پس از ذخیره، پیش‌نمایش برچسب اینجا نمایش داده می‌شود.</p>
  return (
    <div dir="rtl" style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
      <strong>پیش‌نمایش برچسب (۶ × ۸ سانتی‌متر)</strong>
      <img src={`/api/qr-codes/preview?id=${id}`} alt="پیش‌نمایش برچسب QR" style={{ width: '100%', border: '1px solid var(--theme-elevation-150)' }} />
      {token && <code dir="ltr" data-selectable="true">{`/Q/${token}`}</code>}
    </div>
  )
}
```
- [ ] **Step 6 (verify search by product name).** The collection currently uses `listSearchableFields: ['token', 'store', 'note']`. Try adding `'product.name'`: edit that array, run `pnpm --filter @persianpart/cms exec tsc --noEmit`. If it compiles, start the admin later (Task 13) and confirm typing a product name finds its token. If it does NOT compile or does not find results in Task 13, revert to the three-field list and add a read-only text field `productName` kept up to date by a `beforeChange` hook on this collection (reads the product's `name` when `product` changes) and add `'productName'` to `listSearchableFields`. Record which variant you shipped in your final report.
- [ ] **Step 7: Regenerate the import map:** `pnpm --filter @persianpart/cms generate:importmap`. Expected: `apps/cms/src/app/(payload)/admin/importMap.js` now contains `QrExport` and `QrPreview`.
- [ ] **Step 8: Run** `pnpm --filter @persianpart/cms exec tsc --noEmit` (clean) and `pnpm --filter @persianpart/cms test:unit` (0 failures).
- Suggested commit message: `feat(cms): add qr admin generate, export and preview`

---

## Task 9: API (`apps/api`)

**Files:** create `apps/api/src/routers/qr-token.helpers.ts`, `qr-token.helpers.test.ts`; modify `catalog.ts`, `catalog-sync.ts`, `router.helpers.ts`, `offline-data.ts`, and the tests `offline-data.test.ts`, `catalog-record.test.ts`.

- [ ] **Step 1: Write `qr-token.helpers.test.ts`:**

```ts
import { describe, expect, test } from 'bun:test'
import { buildQrTokenMap, qrProductId } from './qr-token.helpers'

describe('qrProductId', () => {
  test('reads ids from numbers and populated objects', () => {
    expect(qrProductId(7)).toBe(7)
    expect(qrProductId({ id: 9 })).toBe(9)
    expect(qrProductId(null)).toBeNull()
    expect(qrProductId(undefined)).toBeNull()
  })
})
describe('buildQrTokenMap', () => {
  test('keeps only active, bound, visible rows and uppercases tokens', () => {
    const rows = [
      { token: 'abcd2345', product: 1, isActive: true },
      { token: 'EFGH2345', product: { id: 2 }, isActive: true },
      { token: 'JKMN2345', product: 3, isActive: false },
      { token: 'PQRS2345', product: null, isActive: true },
      { token: 'TUVW2345', product: 99, isActive: true },
    ]
    expect(buildQrTokenMap(rows, new Set([1, 2, 3]))).toEqual({ ABCD2345: 1, EFGH2345: 2 })
  })
  test('two tokens may point to the same product', () => {
    const rows = [{ token: 'ABCD2345', product: 1, isActive: true }, { token: 'EFGH2345', product: 1, isActive: true }]
    expect(buildQrTokenMap(rows, new Set([1]))).toEqual({ ABCD2345: 1, EFGH2345: 1 })
  })
})
```
- [ ] **Step 2: Run** `pnpm --filter @persianpart/api exec bun test src/routers/qr-token.helpers.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Create `qr-token.helpers.ts`:**

```ts
export interface QrRow {
  token: string
  product: number | { id: number } | null | undefined
  isActive?: boolean | null
}

export function qrProductId(product: QrRow['product']): number | null {
  if (typeof product === 'number') return product
  if (product && typeof product === 'object' && typeof product.id === 'number') return product.id
  return null
}

export function buildQrTokenMap(rows: readonly QrRow[], visibleProductIds: ReadonlySet<number>): Record<string, number> {
  const tokens: Record<string, number> = {}
  for (const row of rows) {
    if (row.isActive === false) continue
    const id = qrProductId(row.product)
    if (id === null || !visibleProductIds.has(id)) continue
    tokens[row.token.trim().toUpperCase()] = id
  }
  return tokens
}
```
- [ ] **Step 4: Run** the Step 2 command. Expected: PASS.
- [ ] **Step 5: Edit `catalog.ts`.** (a) Add import: `import { buildQrTokenMap, qrProductId } from './qr-token.helpers'`. (b) Replace the whole `qrProduct` function, `getByScanCode` and `getProductQr` (from `async function qrProduct(` through the end of `getProductQr`) with:

```ts
async function qrPermissions(userId: string | number) {
  const permissions = await getUserPermissions(userId)
  if (!permissions.canUseProductQr) throw new ORPCError('FORBIDDEN', { message: 'دسترسی اسکن محصول فعال نیست.' })
  return permissions
}

const getByQrToken = customerOnly.catalog.getByQrToken.handler(async ({ input, context }) => {
  const permissions = await qrPermissions(context.user.id)
  const found = await sdk.find({
    collection: 'qr-codes',
    where: { and: [{ token: { equals: input.token } }, { isActive: { equals: true } }] },
    limit: 1,
    depth: 0,
  })
  const productId = qrProductId(found.docs[0]?.product)
  if (productId === null) throw new ORPCError('NOT_FOUND', { message: 'محصول مورد نظر یافت نشد.' })
  const result = await sdk.find({ collection: 'products', where: { id: { equals: productId }, isActive: { equals: true } }, limit: 1, depth: 2 })
  const product = result.docs[0] as Product | undefined
  const category = typeof product?.category === 'object' ? product.category?.id : product?.category
  if (!product || (permissions.allowedCategoryIds.length > 0 && (!category || !permissions.allowedCategoryIds.includes(Number(category))))) {
    throw new ORPCError('NOT_FOUND', { message: 'محصول مورد نظر یافت نشد.' })
  }
  return catalogRecord((await attachWarehouseStock([product]))[0]!, context, { permissions, scopeKey: (await catalogScope(context)).scopeKey })
})

const listQrTokens = customerOnly.catalog.listQrTokens.handler(async ({ context }) => {
  const permissions = await qrPermissions(context.user.id)
  const rows: Array<{ token: string; product: number | { id: number } | null | undefined; isActive?: boolean | null }> = []
  for (let page = 1; ; page++) {
    const result = await sdk.find({
      collection: 'qr-codes',
      where: { and: [{ isActive: { equals: true } }, { product: { exists: true } }] },
      limit: 1000, page, depth: 0,
    })
    rows.push(...result.docs)
    if (!result.hasNextPage) break
  }
  const productIds = [...new Set(rows.flatMap((row) => { const id = qrProductId(row.product); return id === null ? [] : [id] }))]
  const visible = new Set<number>()
  for (let i = 0; i < productIds.length; i += 500) {
    const chunk = productIds.slice(i, i + 500)
    const result = await sdk.find({
      collection: 'products',
      where: { and: [
        { id: { in: chunk } },
        { isActive: { equals: true } },
        ...(permissions.allowedCategoryIds.length ? [{ category: { in: permissions.allowedCategoryIds } }] : []),
      ] },
      select: {}, limit: chunk.length, depth: 0,
    })
    for (const doc of result.docs) visible.add(doc.id)
  }
  return { tokens: buildQrTokenMap(rows, visible) }
})
```
  (c) In the `base.catalog.router({ ... })` object replace `getByScanCode,` and `getProductQr,` with `getByQrToken,` and `listQrTokens,`.
- [ ] **Step 6: Edit `catalog-sync.ts`.** (1) In `catalogScope`'s `scopeKey` array append the literal `'qr-tokens-v1'` as the **last** element (so every client's scope key changes once and old offline packages are re-downloaded). (2) In `productProjection` delete `scanCode: true, ` (leave the rest of that line). (3) In `catalogRecord` delete the whole `scanHash: …,` line. (4) In `syncPage` delete the whole `const offlineQr = … : undefined` statement (3 lines) and change the return to `return { scopeKey: scope.scopeKey, items: products.map(product => catalogRecord(product, context, scope)), nextCursor }`.
- [ ] **Step 7: Edit `router.helpers.ts`.** (1) In `applyProductPricing` change `const { basePricePerSqm, scanCode, ...safeProduct } = product` to `const { basePricePerSqm, ...safeProduct } = product` and delete the line `    hasScanCode: Boolean(scanCode),`. (2) In `sanitizeOrderForCustomer` change `const { basePricePerSqm, scanCode, ...safeProduct } = safeItem.product` to `const { basePricePerSqm, ...safeProduct } = safeItem.product`. (3) Delete the whole function `sanitizePlanProducts` **only if** `rg -n "sanitizePlanProducts" apps` shows no other users; if it is used, keep it but change its comment and body to return `plan` unchanged is NOT allowed — instead remove its calls too. (Report what you did.) Keep every `canUseProductQr` permission line.
- [ ] **Step 8: Edit `offline-data.ts`.** (1) Add `import { getUserPermissions } from './router.helpers'`. (2) Change `call(catalog.syncPage, { limit: 100, cursor, includeOfflineQr: true }, options)` to `call(catalog.syncPage, { limit: 100, cursor }, options)` and delete the line `for (const item of page.offlineQr ?? []) data.qr[item.id] = item.scanCode`. (3) After the `do { … } while (cursor)` loop and before `const facets = …`, add:

```ts
  if (context.user?.role === 'customer' && (await getUserPermissions(context.user.id, context)).canUseProductQr) {
    data.qr = (await call(catalog.listQrTokens, undefined, options)).tokens
  }
```
- [ ] **Step 9: Fix tests.** `offline-data.test.ts`: delete `hasScanCode: false,` (line ~19). `catalog-record.test.ts`: delete `hasScanCode: false,` (line ~107); keep `canUseProductQr: false` in permissions. If a test file still fails to compile because a mocked catalog lacks `listQrTokens`, add `listQrTokens: async () => ({ tokens: {} })` to that mock only.
- [ ] **Step 10: Run** `pnpm --filter @persianpart/api test` (Expected 0 failures) and `pnpm --filter @persianpart/api exec tsc --noEmit` (Expected clean). Then `rg -n "scanCode|scanHash|hasScanCode|offlineQr|getByScanCode|getProductQr" apps/api/src` — Expected: no output.
- Suggested commit message: `feat(api): resolve qr tokens for staff and drop scan code endpoints`

---

## Task 10: Public catalog route `/Q/<token>`

**Files:** create `apps/catalog/src/modules/qr/{qr-server.ts, qr-server.test.ts, _qr-inactive.tsx}`, `apps/catalog/src/app/q/[token]/page.tsx`; modify `apps/catalog/next.config.ts`, `apps/catalog/package.json`.

- [ ] **Step 1: Write `qr-server.test.ts`:**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanToken, resolveQrTarget } from './qr-server'

test('cleanToken accepts only canonical tokens, any case, trimmed', () => {
  assert.equal(cleanToken(' abcd2345 '), 'ABCD2345')
  for (const bad of ['abcd234', 'ABCD2340', 'ABCD23456', '', 'abcd2345/x']) assert.equal(cleanToken(bad), null, bad)
})

test('resolveQrTarget maps outcomes', async () => {
  assert.deepEqual(await resolveQrTarget('abcd2345', async () => ({ productId: 7 })), { kind: 'product', id: 7 })
  assert.deepEqual(await resolveQrTarget('bad', async () => ({ productId: 7 })), { kind: 'inactive' })
  const inactive = Object.assign(new Error('x'), { qrInactive: true })
  assert.deepEqual(await resolveQrTarget('ABCD2345', async () => { throw inactive }, (e) => e === inactive), { kind: 'inactive' })
  await assert.rejects(() => resolveQrTarget('ABCD2345', async () => { throw new Error('boom') }, () => false), /boom/)
})
```
- [ ] **Step 2: Add the test glob.** In `apps/catalog/package.json` change the `"test"` script to end with `src/modules/product/*.test.ts src/modules/qr/*.test.ts`.
- [ ] **Step 3: Run** `pnpm --filter @persianpart/catalog test`. Expected: FAIL (module missing).
- [ ] **Step 4: Create `qr-server.ts`:**

```ts
import 'server-only'
import { PayloadSDKError } from '@payloadcms/sdk'
import { readCatalogCMS } from '@/lib/catalog-cms'

const TOKEN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/

export function cleanToken(raw: string): string | null {
  const token = raw.trim().toUpperCase()
  return TOKEN.test(token) ? token : null
}

export function isQrInactive(error: unknown): boolean {
  return (
    error instanceof PayloadSDKError &&
    error.status === 404 &&
    error.errors.some((item) => !!item && typeof item === 'object' && 'code' in item && item.code === 'QR_INACTIVE')
  )
}

export async function resolveQrTarget(
  raw: string,
  read: (token: string) => Promise<{ productId: number }> = (token) => readCatalogCMS('qr', { token }, { cache: 'no-store' }),
  isInactive: (error: unknown) => boolean = isQrInactive,
): Promise<{ kind: 'product'; id: number } | { kind: 'inactive' }> {
  const token = cleanToken(raw)
  if (!token) return { kind: 'inactive' }
  try {
    return { kind: 'product', id: (await read(token)).productId }
  } catch (error) {
    if (isInactive(error)) return { kind: 'inactive' }
    throw error
  }
}
```
  Note: `import 'server-only'` throws outside Next. The existing catalog tests run with `tsx --conditions=react-server`, which makes it a no-op — keep the same script flags.
- [ ] **Step 5: Create `_qr-inactive.tsx`** (copy the markup style from `apps/catalog/src/app/not-found.tsx`):

```tsx
import Link from 'next/link'

export function QrInactive() {
  return (
    <section className="catalog-empty">
      <h1>این کد در حال حاضر فعال نیست</h1>
      <p>برای مشاهدهٔ محصولات می‌توانید به کاتالوگ مراجعه کنید.</p>
      <Link href="/" prefetch={false}>
        مشاهدهٔ کاتالوگ
      </Link>
    </section>
  )
}
```
- [ ] **Step 6: Create `app/q/[token]/page.tsx`:**

```tsx
import { redirect } from 'next/navigation'
import { QrInactive } from '@/modules/qr/_qr-inactive'
import { resolveQrTarget } from '@/modules/qr/qr-server'

export const dynamic = 'force-dynamic'

export default async function QrPage({ params }: { params: Promise<{ token: string }> }) {
  const target = await resolveQrTarget((await params).token)
  if (target.kind === 'product') redirect(`/p/${target.id}`)
  return <QrInactive />
}
```
- [ ] **Step 7: Rewrite for uppercase scans.** In `apps/catalog/next.config.ts` add inside `config` (after `transpilePackages`):

```ts
  async rewrites() {
    return [{ source: '/Q/:token', destination: '/q/:token' }]
  },
```
  First read `node_modules/next/dist/docs/` (search with `rg -il "rewrites" node_modules/next/dist/docs | head`) to confirm `rewrites()` is the supported way in this Next version; if the docs show a different signature, follow the docs.
- [ ] **Step 8: Run** `pnpm --filter @persianpart/catalog test` (Expected PASS), `pnpm --filter @persianpart/catalog exec tsc --noEmit` (clean).
- Suggested commit message: `feat(catalog): resolve /Q/<token> to the product page`

---

## Task 11: Web (`apps/web`)

**Files:** create `apps/web/src/modules/catalog/qr-token.ts`, `qr-token.test.ts` (in `catalog/`, not `products/`: AGENTS.md layer order says `catalog` is lower than `products`). Modify: `modules/catalog/{catalog-data.ts, catalog-coordinator.ts, _catalog-snapshot.ts, _catalog-persistence.ts, catalog-mapper.ts, product-types.ts}`, `modules/catalog/*.test.ts` (5 files), `modules/pwa/{offline-storage.ts, _download-offline-data.ts}`, `modules/products/product-bottom-sheet/product-bottom-sheet.tsx`, `modules/plans/plan-card/_use-plan-products.ts`, `src/sw.ts`, `apps/web/package.json`. Delete `modules/products/product-qr-download.tsx`.

- [ ] **Step 1: Write `apps/web/src/modules/catalog/qr-token.test.ts`:**

```ts
import { describe, expect, test } from 'bun:test'
import { parseQrToken } from './qr-token'

describe('parseQrToken', () => {
  test('reads the token from catalog urls in any case', () => {
    expect(parseQrToken('HTTPS://CATALOG.PERSIANPARTSHOP.IR/Q/ABCD2345')).toBe('ABCD2345')
    expect(parseQrToken('https://x.ir/q/abcd2345/?a=1#b')).toBe('ABCD2345')
    expect(parseQrToken(' /Q/abcd2345 ')).toBe('ABCD2345')
  })
  test('accepts a bare token for manual entry', () => {
    expect(parseQrToken('abcd2345')).toBe('ABCD2345')
  })
  test('rejects everything else', () => {
    for (const bad of ['https://x.ir/p/12', 'ABCD2340', 'ABCD23456', '', '   ', 'javascript:alert(1)'])
      expect(parseQrToken(bad)).toBeNull()
  })
})
```
- [ ] **Step 2: Run** `pnpm --filter @persianpart/web exec bun test src/modules/catalog/qr-token.test.ts`. Expected: FAIL.
- [ ] **Step 3: Create `apps/web/src/modules/catalog/qr-token.ts`:**

```ts
const TOKEN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/
const URL_PATH = /\/q\/([^/?#\s]+)\/?(?:[?#].*)?$/i

export function parseQrToken(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  const fromPath = URL_PATH.exec(text)?.[1]
  const token = (fromPath ?? text).toUpperCase()
  return TOKEN.test(token) ? token : null
}
```
- [ ] **Step 4: Run** the Step 2 command. Expected: PASS.
- [ ] **Step 5: `catalog-data.ts`.** (1) Delete the line `const offlineScanIndexes = new WeakMap<object, Record<string, string>>()` and the whole `function offlineScanIndex(...) { … }` block. (2) In `createCatalogCoordinator(queryClient, { … })` delete the whole `scan: async (scanCode, signal) => { … },` entry (7 lines). (3) In `useCatalogData`'s `useMemo`, delete the line `const scanIndex = offlineScanIndex(pack.data.products)` and change the next line to `return { ...emptyCatalog, byId: pack.data.products, scopeKey: pack.scopeKey, complete: true, completedAt: pack.completedAt ?? 0 }` (keep whatever else was after `completedAt` on that line unchanged). (4) Replace the whole `export async function scanOfflineProduct(code: string) { … }` with:

```ts
export async function scanOfflineProduct(raw: string): Promise<CatalogRecord> {
  const token = parseQrToken(raw)
  if (!token) throw Object.assign(new Error('Invalid QR'), { code: 'BAD_REQUEST' })
  if (readsFromNetwork()) return CatalogRecordSchema.parse(await api.catalog.getByQrToken({ token }))
  const pack = await readSavedOfflinePackage()
  if (!pack || pack.id !== offlinePackageSnapshot()?.id) throw new Error('Offline catalog unavailable')
  const id = pack.data.qr[token]
  const product = id === undefined ? undefined : pack.data.products[String(id)]
  if (!product) throw Object.assign(new Error('Product unavailable'), { code: 'NOT_FOUND' })
  return product
}
```
  (5) Imports: add `import { parseQrToken } from './qr-token'` and change the contract import to `import { CatalogRecordSchema, type CatalogRecord } from '@persianpart/contract'`.
- [ ] **Step 6: `catalog-coordinator.ts`.** Delete: the `scan(code: string, signal: AbortSignal): Promise<CatalogRecord>` line in `Transport`; the `scanIndex: Record<string, string>` line in `CatalogSnapshot`; `scanIndex: {}, ` inside `emptyCatalog`; the line `const pendingScans = new Map<string, Promise<CatalogRecord>>()`; `pendingScans.clear()` (inside `reset`; keep the other statements on that line separated by `;` correctly); and the whole `async scan(code: string) { … },` method. Then run `rg -n "scan" apps/web/src/modules/catalog/catalog-coordinator.ts` — Expected: no output.
- [ ] **Step 7: `_catalog-snapshot.ts`.** Delete the whole `buildScanIndex` function; in `mergeRecords` return `{ ...state, byId, versions, scopeKey: scopeKey ?? state.scopeKey }`; in `finishSweep` return `{ ...state, byId, versions, complete: true, completedAt, restoredAt: undefined }`; in `dropMissing` delete the `const scanIndex = …` line and return `{ ...state, byId, versions }`.
- [ ] **Step 8: `_catalog-persistence.ts`.** In `restoreClient`: delete `const scanIndex: Record<string, string> = {}` and the line `if (parsed.data.scanHash) scanIndex[parsed.data.scanHash] = id`; in the object `data: { ...emptyCatalog, byId: …, restoredAt: saved.timestamp }` delete `scanIndex, `.
- [ ] **Step 9: `catalog-mapper.ts` / `product-types.ts`.** In `catalog-mapper.ts` change line 54 to `type CatalogProductInput = Omit<CatalogRecord, "createdAt"> & {` (keep the rest of that line/object as it was after the `& {`; remove the middle `| "hasScanCode"> & { hasScanCode?: boolean }` pieces) and delete line `    hasScanCode: Boolean(item.hasScanCode),`. In `product-types.ts` delete `  hasScanCode?: boolean`. Read the surrounding 5 lines before editing to keep syntax valid.
- [ ] **Step 10: Offline data.** `pwa/offline-storage.ts`: change `qr: Record<string, string>` to `qr: Record<string, number>`. `pwa/_download-offline-data.ts`: (1) change `api.catalog.syncPage({ cursor: pack.cursor, limit: 100, includeOfflineQr: canUseQr }, options)` to `api.catalog.syncPage({ cursor: pack.cursor, limit: 100 }, options)`; (2) delete the line `const codes = new Map(page.offlineQr?.map(item => [item.id, item.scanCode]))`; (3) in the `for (const record of records)` loop keep only `data.products[record.id] = record` (delete the whole `if (canUseQr && record.hasScanCode) { … }` block); (4) inside `if (!page.nextCursor) {` right after `data.dimensions = facets.dimensions` add:

```ts
      if (canUseQr) data.qr = (await api.catalog.listQrTokens(undefined, options)).tokens
```
- [ ] **Step 11: Remove the QR download.** Delete `apps/web/src/modules/products/product-qr-download.tsx`. In `product-bottom-sheet.tsx`: delete the `const ProductQrDownload = lazy(…)` line (26); delete `const [qrOpen, setQrOpen] = useState(false);` (50) and the `setQrOpen(false);` line (53); delete the whole `{user?.canUseProductQr && activeProduct.hasScanCode && <Button … </Button>}` element (line 138); delete the `{qrOpen && <Suspense …><ProductQrDownload … /></Suspense>}` line (152). Then run `rg -n "lazy|Suspense|useState" apps/web/src/modules/products/product-bottom-sheet/product-bottom-sheet.tsx` and remove any import that is now unused (`lazy`, `Suspense`, `useState`) **only if** unused elsewhere in that file.
- [ ] **Step 12: Dependencies and service worker.** Run `pnpm --filter @persianpart/web remove qrcode @types/qrcode`. In `apps/web/src/sw.ts` delete the line `/\/product-qr-download-.*\.js$/,` from `requiredChunks` (keep the zxing and camera lines).
- [ ] **Step 13: Plan-card schema rename.** In `_use-plan-products.ts` replace both occurrences of `ScannedCatalogProductSchema` with `CatalogProductDetailSchema`.
- [ ] **Step 14: Fix the five tests** in `apps/web/src/modules/catalog/`: `_browse-offline.test.ts` line 8, `catalog-family.test.ts` line 17, `catalog-mapper.test.ts` line 78: delete `hasScanCode: false,` (and on `_browse-offline.test.ts` keep the rest of the line). `catalog-coordinator.test.ts`: (a) in `fixture()` change `let idsCalls = 0, scans = 0` to `let idsCalls = 0`; (b) delete the transport line `async scan(…) { scans++; return product(3) },`; (c) delete `, scans: () => scans` from the returned object; (d) delete the whole test `test('QR matches a local hash without a lookup; …', async () => { … })`; (e) on line 10 remove `hasScanCode: false,` from the `product` helper if present (use `rg -n hasScanCode` to find it). `_catalog-snapshot.test.ts`: replace the whole file with:

```ts
import { describe, expect, test } from 'bun:test'
import type { CatalogRecord } from '@persianpart/contract'
import { emptyCatalog, type CatalogSnapshot } from './catalog-coordinator'
import { dropMissing, finishSweep, mergeRecords } from './_catalog-snapshot'

const record = (id: number) => ({ id }) as unknown as CatalogRecord
const state = (records: CatalogRecord[], versions: Record<string, number>): CatalogSnapshot => {
  const byId = Object.fromEntries(records.map(item => [String(item.id), item]))
  return { ...emptyCatalog, byId, versions }
}

describe('catalog snapshot transforms', () => {
  test('merge keeps a newer read', () => {
    const before = state([record(1)], { '1': 5 })
    const stale = mergeRecords(before, [record(1)], null, 4)
    expect(stale.byId['1']).toBe(before.byId['1'])
    const next = mergeRecords(before, [record(1), record(2)], 'scope', 6)
    expect(next.versions).toEqual({ '1': 6, '2': 6 })
    expect(next.scopeKey).toBe('scope')
  })

  test('finishing a sweep drops unseen records unless a newer targeted read kept them', () => {
    const before = state([record(1), record(2), record(3), record(4)], { '1': 3, '2': 3, '3': 9, '4': 9 })
    const next = finishSweep(before, new Set(['1']), new Set(['3']), 5, 1234)
    expect(Object.keys(next.byId).sort()).toEqual(['1', '3'])
    expect(next.versions).toEqual({ '1': 3, '2': 5, '3': 9, '4': 9 })
    expect(next).toMatchObject({ complete: true, completedAt: 1234, restoredAt: undefined })
  })

  test('dropMissing removes requested ids that were not found and are not newer', () => {
    const before = state([record(1), record(2)], { '1': 2, '2': 8 })
    const next = dropMissing(before, ['1', '2'], new Set(), 5)
    expect(Object.keys(next.byId)).toEqual(['2'])
    expect(next.versions).toEqual({ '1': 5, '2': 8 })
  })
})
```
- [ ] **Step 15: Run** `pnpm --filter @persianpart/web test:unit` (Expected: 0 failures), `pnpm --filter @persianpart/web exec tsc --noEmit` (clean), `pnpm --filter @persianpart/web build` (success). Then `ls apps/web/dist/assets | grep -E "zxing|product-qr"` — Expected: a `zxing_reader-*.wasm` and a `product-qr-camera-*.js`, and **no** `product-qr-download-*`.
- Suggested commit message: `feat(web): scan qr token urls and carry token map offline`

---

## Task 12: Documentation

**Files:** `docs/product/domain-models.md`, `docs/product/access-control.md`, `docs/architecture/system-architecture.md`, `docs/architecture/pwa.md`, `docs/architecture/public-catalog.md`, `docs/operations/runbook.md`.

- [ ] **Step 1:** For each file run `rg -n "scanCode|scan_code|getByScanCode|getProductQr|QR" <file>` and edit those lines so they describe the new system, in the style of the surrounding text: (1) `domain-models.md`: replace the products `scanCode` rule with a `qr-codes` model (fields `token`, `product`, `store`, `note`, `isActive`; tokens are opaque, many-to-one, only managers/superadmins edit, no deletion, label is 60 × 80 mm). (2) `access-control.md`: `canUseProductQr` now only gates staff scanning in the web app; binding tokens is manager/superadmin only. (3) `system-architecture.md`: endpoints `catalog.getByQrToken`, `catalog.listQrTokens`, CMS operation `qr`; QR image generation is CMS-side. (4) `pwa.md`: offline package carries `token → productId`; scope key includes `qr-tokens-v1`. (5) `public-catalog.md`: add route `/Q/<token>` (dynamic, no ISR, temporary redirect to `/p/<id>`, inactive page for unknown/inactive/unpublished) and a note that the proxy rate limit should also cover `/Q/*`. (6) `runbook.md`: write the two-release rollout: Release 1 = code + expand migration (backup first, rehearse on a clone, never `migrate:down`), Release 2 = drop `products.scan_code` only after every container runs Release 1.
- [ ] **Step 2: Run** `rg -n "scanCode|scan_code|getByScanCode|getProductQr|scanHash|hasScanCode|offlineQr" docs apps packages --glob '!**/migrations/**' --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**' --glob '!**/payload-types.ts'`. Expected: only the negative assertion `'scanCode'` in `apps/cms/src/modules/catalog/catalog-mapper.test.ts` (and runbook lines about Release 2 if you mention the column name).
- Suggested commit message: `docs: describe qr token labels and rollout`

---

## Task 13: Whole-feature verification gate (Release 1)

- [ ] **Step 1:** `pnpm install --frozen-lockfile=false` then `pnpm check-types`. Expected: no `error TS`.
- [ ] **Step 2:** `pnpm test:unit`. Expected: all workspaces 0 failures.
- [ ] **Step 3:** `pnpm --filter @persianpart/web build` and `pnpm --filter @persianpart/catalog build`. Expected: both succeed. (Do **not** build the CMS unless the human asks.) Then run `git checkout apps/catalog/next-env.d.ts` — the build rewrites this generated file and the change must not be kept. Run `git status --porcelain` and make sure no `next-env.d.ts`, `.next/`, `dist/` or `.qr-design-spike/` entries are part of your change list.
- [ ] **Step 4:** Confirm Release 1 did not remove the DB column: `rg -n "scan_code" apps/cms/src/migrations/index.ts apps/cms/src/migrations/20261125_120000_qr_codes.ts` — Expected: no match (the column is only in the baseline migration).
- [ ] **Step 5 (needs a running stack — if you cannot run it, list as NOT DONE in your report and stop):** with a throwaway database from Task 5 start CMS, API, catalog, web; in the CMS admin generate 3 codes with store `تست`; bind two of them to the same product; select two rows and download the ZIP — it contains two PNGs named `تست-<TOKEN>.png`, each 2400 × 3200 px; open one and scan it with a phone; `curl -sI http://localhost:5176/Q/<TOKEN>` returns `307` with `location: /p/<id>`; an unbound or unknown token returns the Persian inactive page; lowercase `/q/<token>` behaves the same; the web scanner opens the product online and offline; re-bind a token, refresh the offline package, scan again → new product; search by token, store and product name finds the row.
- [ ] **Step 6:** Write your final report: files changed, commands run with their results, steps NOT DONE, and every place where you deviated from this plan (with the reason).

---

## Task 14 (Release 2 — ONLY when the human explicitly asks)

> Preconditions: Release 1 is deployed everywhere and no container runs the old code. Never run this on your own.

**Files:** create `apps/cms/src/migrations/20261201_120000_drop_product_scan_code.ts`; register in `migrations/index.ts` at that time; update `docs/operations/runbook.md`.

- [ ] **Step 1: Create the migration:**

```ts
import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// Contract step: removes only the legacy products.scan_code column and its unique index.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const before = await db.execute(sql`SELECT count(*)::int AS n FROM "products"`)
  await db.execute(sql`
    DROP INDEX IF EXISTS "products_scan_code_idx";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "scan_code";
  `)
  const after = await db.execute(sql`SELECT count(*)::int AS n FROM "products"`)
  const count = (result: { rows: unknown[] }) => (result.rows[0] as { n: number } | undefined)?.n
  if (count(before) !== count(after)) throw new Error('products row count changed; aborting')
}

// Restores an empty column and index; the old values cannot be restored (old labels were discarded by owner decision).
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "scan_code" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "products_scan_code_idx" ON "products" USING btree ("scan_code");
  `)
}
```
- [ ] **Step 2: Rehearse on a clone of the production database** (counts of `products`, `users`, `orders`, `plans` identical before/after; `\d products` shows no `scan_code`; the app starts and catalog sync works).
- [ ] **Step 3:** Take the production backup, then the human runs `pnpm migrate:cms` and `pnpm migrate:cms:status`.
