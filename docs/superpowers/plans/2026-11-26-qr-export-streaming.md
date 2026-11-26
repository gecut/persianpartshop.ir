# QR Export Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CMS `/api/qr-codes/export` endpoint use bounded memory and leave the 1-CPU CMS container responsive while exporting up to 500 labels.

**Architecture:** Replace the buffered `renderAll → zipSync → Response` path with a pull-based `ReadableStream` that renders one label, feeds it to an fflate streaming `Zip` (stored, no compression), and only renders the next label when the consumer pulls again. Limit libvips to one worker thread and disable its operation cache, yield to the event loop between labels, and allow one export at a time per process.

**Tech Stack:** Payload v3 custom endpoints (Next.js, Node), `fflate` 0.8 (`Zip`, `ZipPassThrough`), `sharp` 0.35, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-26-qr-token-labels-design.md` (export = ZIP of print-ready PNGs, max 500). Measurements behind this plan (local, 4-core Mac): about 60 ms of sharp/librsvg time per label (34 ms raster + 20 ms PNG encode), about 290 KB per PNG, JS main thread about 90% idle. CMS limits in `docker-compose.yml`: `cpus: "1.00"`, `memory: 1024M`, healthcheck `/admin` `timeout: 5s`, `retries: 3`.

## Global Constraints

- Label output unchanged: same `renderLabel` SVG, 2400 × 3200 px PNG, sRGB ICC, density metadata. Do not touch `render-label.ts` geometry or PNG options.
- ZIP entries stay stored (level 0, PNG already compressed); entry names keep coming from `zipEntryName(store, token)`.
- `MAX_COUNT = 500` and `parseExportBody` stay as they are.
- Response headers stay: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="qr-labels-YYYYMMDD.zip"`, `Cache-Control: private, no-store`.
- Persian copy for new errors (exact):
  - busy (HTTP 429): `خروجی دیگری در حال ساخت است؛ چند لحظه بعد دوباره تلاش کنید.`
  - client, stream broke mid-download: `دریافت خروجی نیمه‌کاره ماند؛ دوباره تلاش کنید.`
- No new dependencies. No `any`. Kebab-case files. Single CMS replica is assumed, so an in-process lock is sufficient.
- Do not commit. The user reviews the uncommitted diff.

## Review Focus

1. Admin closes the tab or navigates away mid-export → rendering stops (no further `renderLabel` calls) and the export lock is released.
2. One label fails to render mid-stream (headers already sent) → the stream errors, the lock is released, the server logs `QR export failed`, and the browser shows the Persian "incomplete" message rather than an English `TypeError`.
3. A second export while one runs → 429 with the busy copy; the running export is unaffected.
4. All requested ids missing → 404 as today, and the lock is not left held.
5. Lock release must happen exactly once whether the stream completes, errors or is cancelled.

---

## File Structure

- Create `apps/cms/src/modules/qr-label/label-zip-stream.ts`: the streaming ZIP producer (no Payload knowledge).
- Create `apps/cms/src/modules/qr-label/label-zip-stream.test.ts`: tests for it.
- Modify `apps/cms/src/modules/qr-label/render-label.ts`: sharp process settings only (top of the file).
- Modify `apps/cms/src/collections/qr-codes/_label.endpoints.ts`: remove `buildZip`, add the export lock, and stream the response.
- Modify `apps/cms/src/collections/qr-codes/_label.endpoints.test.ts`: drop the `buildZip` test and add the lock test.
- Modify `apps/cms/src/collections/qr-codes/components/qr-export.tsx`: handle a broken stream.
- Modify `apps/cms/package.json`: add the new test file to `test:unit`.

---

### Task 1: Streaming label ZIP

**Files:**
- Create: `apps/cms/src/modules/qr-label/label-zip-stream.ts`
- Test: `apps/cms/src/modules/qr-label/label-zip-stream.test.ts`
- Modify: `apps/cms/package.json` (`test:unit` script: append `src/modules/qr-label/label-zip-stream.test.ts`)

**Interfaces:**
- Produces:
  ```ts
  export interface LabelZipEntry { name: string; token: string }
  export function labelZipStream(
    entries: readonly LabelZipEntry[],
    render: (token: string) => Promise<Uint8Array>,
    onSettled: (error?: unknown) => void,
  ): ReadableStream<Uint8Array>
  ```
  `onSettled` is called exactly once: with no argument after the final ZIP chunk, with the error on a render or zip failure, and with no argument on consumer cancel.

- [ ] **Step 1: Write the failing tests** in `label-zip-stream.test.ts` (`node:test` + `node:assert/strict`, `unzipSync` from `fflate`). The helper `collect(stream)` reads every chunk and concatenates them into one `Uint8Array`.
  - `round-trips names and bytes in order`: entries `a.png`/`T1` and `b.png`/`T2`, with render returning `new Uint8Array([1,2,3])` for T1 and `[4]` for T2. Assert `Object.keys(unzipSync(bytes))` equals `['a.png','b.png']`, that the bytes match, and that `onSettled` was called once with `undefined`.
  - `renders lazily, one label per pull`: 5 entries and a counting render. Create a reader, `await reader.read()` once, then `await reader.cancel()`. Assert render calls `< 5` and `onSettled` was called once.
  - `errors the stream and settles once when a render fails`: the render for the 2nd entry rejects with `new Error('boom')`. Assert `collect(stream)` rejects with `/boom/`, and that `onSettled` was called once with that error.
  - `rejects an empty entry list`: `assert.throws(() => labelZipStream([], render, onSettled), RangeError)`.

- [ ] **Step 2: Run the tests and see them fail**
  Run: `pnpm --filter @persianpart/cms exec tsx --test src/modules/qr-label/label-zip-stream.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `labelZipStream`.**
  Use `new ReadableStream<Uint8Array>({ start, pull, cancel }, { highWaterMark: 0 })`, so nothing renders before the first read.
  - `start`: create `new Zip((err, chunk, final) => …)`. On `err`, error the controller and settle with it. Otherwise enqueue `chunk`. When `final`, close the controller and settle.
  - `pull`: if every entry has been added, call `zip.end()` and return. Otherwise:
    1. `await new Promise(r => setImmediate(r))` so other requests can run between labels.
    2. Render the next token.
    3. `const file = new ZipPassThrough(name); zip.add(file); file.push(png, true)`.
  - On any rejection inside `pull`: `controller.error(e)`, `zip.terminate()`, settle with `e`.
  - `cancel`: set a cancelled flag that `pull` checks after its awaits, call `zip.terminate()`, settle with no argument.
  - Guard settlement with a `settled` boolean so it happens once. Throw `RangeError('no entries')` for an empty list.

- [ ] **Step 4: Run the tests and see them pass**
  Run: the same command as Step 2. Expected: 4 passing.

### Task 2: Endpoint uses the stream, lock, sharp limits

**Files:**
- Modify: `apps/cms/src/collections/qr-codes/_label.endpoints.ts` (`buildZip`, `exportZip` handler, `fflate` import)
- Modify: `apps/cms/src/modules/qr-label/render-label.ts` (top-level, after imports)
- Test: `apps/cms/src/collections/qr-codes/_label.endpoints.test.ts`

**Interfaces:**
- Consumes: `labelZipStream`, `LabelZipEntry` from Task 1.
- Produces: `export function acquireExportSlot(): (() => void) | null` in `_label.endpoints.ts`. It returns a release function, or `null` while another export holds the slot. The release is idempotent.

- [ ] **Step 1: Write the failing test** in `_label.endpoints.test.ts`.
  - Remove the `buildZip` import and its test, along with the now-unused `unzipSync` import.
  - Add `acquireExportSlot allows one export at a time`:
    1. `const release = acquireExportSlot(); assert.ok(release); assert.equal(acquireExportSlot(), null)`.
    2. `release(); release()` (calling it twice is harmless).
    3. `const again = acquireExportSlot(); assert.ok(again); again!()`.

- [ ] **Step 2: Run it and see it fail**
  Run: `pnpm --filter @persianpart/cms exec tsx --test src/collections/qr-codes/_label.endpoints.test.ts`
  Expected: FAIL (`acquireExportSlot` is not exported).

- [ ] **Step 3: Implement.**
  - `render-label.ts`: after the imports, add:
    ```ts
    // The CMS container has one CPU; libvips otherwise starts one thread per host core and keeps an operation cache.
    sharp.concurrency(1)
    sharp.cache(false)
    ```
  - `_label.endpoints.ts`:
    - Delete `buildZip` and the `zipSync` import.
    - Add `acquireExportSlot` (module-level `let exporting = false`).
    - In `exportZip`, after `canManageQr` and the `catalogUrl()` check, run `parseExportBody`. Then do `const release = acquireExportSlot()`; if it is null, `return bad('خروجی دیگری در حال ساخت است؛ چند لحظه بعد دوباره تلاش کنید.', 429)`.
    - Wrap the `find` call and the 404 path so that `release()` runs whenever no stream is returned (try/catch around the setup, with release in the catch and before `return bad(…404)`).
    - Build `entries = found.docs.map(doc => ({ name: zipEntryName(doc.store, doc.token), token: doc.token }))`.
    - Return `new Response(labelZipStream(entries, renderToken, error => { release(); if (error) req.payload.logger.error({ msg: 'QR export failed', error: error instanceof Error ? error.message : 'unknown' }) }), { headers })`, with the same headers as today.
    - `renderToken` stays as is. `Buffer` is a `Uint8Array`, so no cast is needed.

- [ ] **Step 4: Run the CMS unit suite and type check**
  Run: `pnpm --filter @persianpart/cms test:unit`. Expected: 0 failures.
  Run: `pnpm --filter @persianpart/cms exec tsc --noEmit`. Expected: no errors.

- [ ] **Step 5: Measure memory with 500 labels.** Write a scratch script (outside the repo) that:
  1. Builds 500 entries.
  2. Pipes `labelZipStream(entries, t => renderLabel(labelUrl('https://catalog.example', t)).then(r => r.png), () => {})` into a sink that only counts bytes.
  3. Samples `process.memoryUsage().rss` every 100 ms.

  Expected: peak RSS under 300 MB (the old path held about 290 MB of PNG and ZIP buffers on top of the baseline), and `unzipSync` of a 3-label run returns 3 valid PNGs.

### Task 3: Client handles a broken stream

**Files:**
- Modify: `apps/cms/src/collections/qr-codes/components/qr-export.tsx:60-80` (`exportZip`)

**Interfaces:**
- Consumes: the endpoint's 429 JSON `{ error }` (already handled by the `!response.ok` branch).

- [ ] **Step 1: Implement.** Replace `await response.blob()` with
  `await response.blob().catch(() => { throw new Error('دریافت خروجی نیمه‌کاره ماند؛ دوباره تلاش کنید.') })`. Nothing else changes.

- [ ] **Step 2: Verify**
  Run: `pnpm --filter @persianpart/cms exec tsc --noEmit`. Expected: no errors.
  Run: `pnpm --filter @persianpart/cms test:unit`. Expected: 0 failures.

## Not covered here (manual, needs Docker)

- A real 500-label export in the 1-CPU / 1 GB container while `/admin` is polled every few seconds: `/admin` keeps answering under 5 s, and the container is not restarted.
