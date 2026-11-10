# Verification Handoff Report: SMS Module & Technical Debt Audit

## 1. Observation

### 1.1 Unit Test Execution (`pnpm --filter @persianpart/cms test:hardening`)
- **Execution Command**: `pnpm --filter @persianpart/cms test:hardening`
- **Runner**: Node.js test runner via `tsx --test`
- **Exit Code**: `0`
- **Verbatim Summary Output**:
```
ℹ tests 100
ℹ suites 0
ℹ pass 100
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 12285.896792
```
- **Test File Coverage**: 12 test files executed:
  1. `src/_sdk.test.ts`
  2. `src/_seed-target.test.ts`
  3. `src/lib/sms.test.ts`
  4. `src/modules/sms/sms.unit.test.ts` (9 dedicated SMS unit tests)
  5. `src/collections/orders/_reservation.test.ts`
  6. `src/collections/products/_products.test.ts`
  7. `src/collections/products/_access.test.ts`
  8. `src/collections/warehouse-stock/_stock-operations.test.ts`
  9. `src/collections/warehouse-stock/_import-csv.test.ts`
  10. `src/collections/orders/_transition.test.ts`
  11. `src/lib/committed-sms.test.ts`
  12. `src/lib/business-validation.test.ts`
- **SMS Specific Unit Tests Verified**:
  - `✔ SMS client utilities: maskPhone, maskEndpoint, sanitizeToken, normalizeReceptor (2.399834ms)`
  - `✔ sendKavenegarPattern: dev/test mode bypassing and missing key validation (4.019125ms)`
  - `✔ sendKavenegarPattern: live fetch with successful status and token parameters (94.768208ms)`
  - `✔ sendKavenegarPattern: rejects on API error and masks sensitive information (2.971542ms)`
  - `✔ processSmsQueueTick: transitions jobs through pending, retry_scheduled, and failed with FIFO order and accurate attempts (6.753208ms)`
  - `✔ enqueueSms: normalizes receptor, ignores empty, and enforces overrideAccess (0.354209ms)`
  - `✔ getNotificationSettings: reads global with overrideAccess and normalizes admin phones (0.614333ms)`
  - `✔ retrySmsEndpoint: enforces role, integer ID, failed status requirement, and overrideAccess (2.058666ms)`
  - `✔ sendOtpBeforeChange: requires receptor, skips on context.skipSms, and skips on unchanged code (0.472708ms)`
- **External Dependency Status**: 0 live external network calls required; all unit tests run hermetically using mocked fetch and in-memory assertions.

### 1.2 TypeScript Compilation Check (`pnpm --filter @persianpart/cms exec tsc --noEmit`)
- **Execution Command**: `pnpm --filter @persianpart/cms exec tsc --noEmit`
- **Exit Code**: `0`
- **Output**: Empty (0 compilation errors, strict typechecking satisfied).

### 1.3 Complete Decoupling of Kavenegar from `apps/api`
- **Inspection of `apps/api/package.json`**:
  - Direct Dependencies (lines 29–42): `@orpc/client`, `@orpc/contract`, `@orpc/openapi`, `@orpc/server`, `@payloadcms/sdk`, `@persianpart/cms`, `@persianpart/contract`, `cross-env`, `dotenv`, `hono`, `pg`, `zod`.
  - Dev Dependencies (lines 43–48): `@types/bun`, `@types/node`, `@types/pg`, `typescript`.
  - **Result**: No `kavenegar` library or wrapper exists in `apps/api/package.json`.
- **Inspection of Source Code in `apps/api/src/`**:
  - File `apps/api/src/lib/kavenegar.ts`: Deleted (`stat: no such file or directory`).
  - Grep search for `kavenegar` (case-insensitive) across `apps/api/src/`:
    Only 1 match found: line 15 of `apps/api/src/routers/auth.ts`:
    `15: * Shared OTP request logic using Kavenegar pattern lookup service`
    (Non-executable JSDoc comment).
  - Grep search for `KAVENEGAR` in `docker-compose.yml`:
    Occurs only at line 75 under `cms:` (`KAVENEGAR_API_KEY: ${KAVENEGAR_API_KEY:-}`); 0 occurrences under `api:` (lines 20–60).
  - OTP dispatch in `apps/api`: `apps/api/src/lib/otp.ts:69-79` creates/updates documents in the `otps` Payload collection. All dispatch logic is delegated to CMS hooks.

---

### 1.4 Code Evidence for the 4 Technical Debt Closures

#### TD-SEC-03: Kavenegar credentials/client securely located in CMS only
- **Original Debt**: Hardcoded operational API key in `apps/api/src/lib/kavenegar.ts:35-36` and `docker-compose.yml:41`.
- **Current Evidence in Code**:
  - File: `apps/cms/src/modules/sms/kavenegar-client.ts:58-74`:
    ```typescript
    const apiKey = process.env.KAVENEGAR_API_KEY?.trim()
    ...
    if (!apiKey) {
      throw new Error('کلید وب‌سرویس پیامک (KAVENEGAR_API_KEY) در سرور CMS تنظیم نشده است.')
    }

    const endpoint = `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`
    ```
  - Docker Compose: `docker-compose.yml:75` passes `KAVENEGAR_API_KEY` exclusively to `cms:`.
  - No default fallback keys or hardcoded strings exist in source code.

#### TD-SEC-08: Masking in logs & blocking OTP delivery
- **Original Debt**: API key and phone numbers leaking in error logs (`apps/api/src/lib/kavenegar.ts:94-99`).
- **Current Evidence in Code**:
  - Masking utilities in `apps/cms/src/modules/sms/kavenegar-client.ts:30-37`:
    ```typescript
    export function maskPhone(phone: string): string {
      if (!phone || phone.length < 8) return '***'
      return `${phone.slice(0, 4)}***${phone.slice(-4)}`
    }

    export function maskEndpoint(endpoint: string): string {
      return endpoint.replace(/\/v1\/[^/]+/, '/v1/***')
    }
    ```
  - Safe error logger in `apps/cms/src/modules/sms/kavenegar-client.ts:118-124`:
    ```typescript
    console.error('[Kavenegar Gateway Error]', {
      endpoint: maskEndpoint(endpoint),
      receptor: maskPhone(cleanReceptor),
      template: params.template,
      error: err?.message || err,
    })
    ```
  - Blocking P0 delivery hook in `apps/cms/src/collections/otps/_send-otp.before-change.ts:5-20`:
    ```typescript
    export const sendOtpBeforeChange: CollectionBeforeChangeHook = async ({ data, originalDoc, context }) => {
      if (context?.skipSms) return data

      if (data?.code && data.code !== originalDoc?.code) {
        const receptor = data.phone || originalDoc?.phone
        if (!receptor) {
          throw new Error('شماره همراه جهت ارسال کد تایید الزامی است.')
        }
        await sendKavenegarPattern({
          template: SMS_TEMPLATES.OTP,
          receptor,
          tokens: { token: data.code },
        })
      }
      return data
    }
    ```
    If `sendKavenegarPattern` rejects, the error aborts the Payload `beforeChange` lifecycle, preventing the OTP code from persisting in PostgreSQL.
  - Read protection in `apps/cms/src/collections/otps/otps.collection.ts:31-42`: `afterRead` hook strips/nullifies expired codes.

#### TD-BE-09: Timeout & persistent queue collection with retry mechanics
- **Original Debt**: Missing timeout on SMS requests (`apps/api/src/lib/kavenegar.ts:72-84`), risking hanging sockets.
- **Current Evidence in Code**:
  - Hard timeout in `apps/cms/src/modules/sms/kavenegar-client.ts:4, 94`:
    ```typescript
    const KAVENEGAR_TIMEOUT_MS = 5_000
    ...
    signal: AbortSignal.timeout(KAVENEGAR_TIMEOUT_MS),
    ```
  - Persistent queue collection in `apps/cms/src/collections/sms-queue/sms-queue.collection.ts:6-109`:
    - Slug: `'sms-queue'`
    - Managed fields: `receptor`, `template`, `tokens`, `status` (`'pending' | 'retry_scheduled' | 'sent' | 'failed'`), `attempts`, `lastError`, `nextRetryAt`, `sentAt`.
  - Queue worker in `apps/cms/src/modules/sms/queue-worker.ts:4-77`:
    - Strict FIFO order: `sort: 'createdAt'` (line 19)
    - Batch size: `limit: 10` (line 20)
    - 30-second backoff retry:
      ```typescript
      if (attempts < 2) {
        const nextRetryAt = new Date(Date.now() + 30_000).toISOString()
        await payload.update({
          collection: 'sms-queue',
          id: job.id,
          data: {
            status: 'retry_scheduled',
            attempts,
            nextRetryAt,
            lastError: err?.message || String(err),
          },
          overrideAccess: true,
        })
      } else {
        await payload.update({
          collection: 'sms-queue',
          id: job.id,
          data: {
            status: 'failed',
            attempts,
            lastError: err?.message || String(err),
          },
          overrideAccess: true,
        })
      }
      ```
  - Background loop lifecycle in `apps/cms/src/modules/sms/queue-worker.ts:82-112`:
    `startSmsQueueWorker(payload, intervalMs = 10_000)` initialized on startup in `apps/cms/src/payload.config.ts:51-56`.
  - Admin manual replay endpoint in `apps/cms/src/collections/sms-queue/_retry-sms.endpoint.ts:4-48`:
    Endpoint `POST /api/sms-queue/:id/retry` allows `superadmin` and `manager` to reset `failed` jobs back to `pending`.

#### TD-BE-06: 9 approved production templates & non-blocking plans queueing
- **Original Debt**: Synchronous batch SMS loop in `plans.collection.ts:58-80` blocking server threads for minutes.
- **Current Evidence in Code**:
  - Non-blocking enqueuing in `apps/cms/src/collections/plans/plans.collection.ts:88-94`:
    ```typescript
    await enqueueSms(req.payload, {
      receptor: userDoc.phone,
      template: SMS_TEMPLATES.PLAN_ASSIGNED,
      tokens: { token: planTitle },
      req,
    })
    ```
    Writes directly to `sms-queue` within milliseconds; zero blocking of HTTP thread.
  - 9 Approved Production Templates in `apps/cms/src/modules/sms/constants.ts:1-11`:
    1. `otp`: 'otp'
    2. `order-registered`: 'order-registered'
    3. `order-approved`: 'order-approved'
    4. `order-cancelled`: 'order-cancelled'
    5. `admin-new-order`: 'admin-new-order'
    6. `admin-order-cancelled`: 'admin-order-cancelled'
    7. `supply-result`: 'supply-result'
    8. `admin-new-supply-request`: 'admin-new-supply-request'
    9. `plan-assigned`: 'plan-assigned'
  - Type-safe token contracts in `apps/cms/src/modules/sms/types.ts:3-13`:
    `TemplateTokenMap` strictly constrains single-token (`token`) vs two-token (`token`, `token2`) payloads.
  - Global Admin Notification Settings in `apps/cms/src/globals/notification-settings.global.ts:5-48`:
    Configures `adminPhones` list, `enableOrderNotifications`, and `enableSupplyNotifications`.

---

## 2. Logic Chain

1. **Step 1 (Grounding Test Execution)**: Observation 1.1 records 100/100 tests passing in `pnpm --filter @persianpart/cms test:hardening` without errors or timeouts. Observation 1.2 records clean compilation in `pnpm --filter @persianpart/cms exec tsc --noEmit`. Therefore, the SMS module and related CMS systems are syntactically sound, type-safe, and pass all automated regression checks.
2. **Step 2 (Isolation & Decoupling)**: Observation 1.3 shows that `apps/api/src/lib/kavenegar.ts` has been deleted, `apps/api/package.json` contains no Kavenegar package, and `docker-compose.yml` injects `KAVENEGAR_API_KEY` solely into `cms:`. Therefore, Kavenegar integration is 100% decoupled from `apps/api`.
3. **Step 3 (P0 vs P1 Architecture & Technical Debt Resolution)**:
   - Observation 1.4 confirms TD-SEC-03 is resolved: `apps/cms/src/modules/sms/kavenegar-client.ts:58-74` retrieves credentials exclusively from environment variables in CMS without hardcoded fallbacks.
   - Observation 1.4 confirms TD-SEC-08 is resolved: URLs and phone numbers are masked in logs (`maskPhone`, `maskEndpoint`), and OTP is dispatched synchronously in `_send-otp.before-change.ts:13-17` before database write.
   - Observation 1.4 confirms TD-BE-09 is resolved: 5-second `AbortSignal.timeout` prevents hanging sockets, and `sms-queue` collection with `queue-worker.ts` handles persistent background retries (30s delay, max 2 attempts, manual replay endpoint).
   - Observation 1.4 confirms TD-BE-06 is resolved: 9 production templates are registered, plans assignment uses fast non-blocking `enqueueSms`, and admin phone targets are driven by `notification-settings.global.ts`.

---

## 3. Caveats

1. **Auth Router Docstring**: `apps/api/src/routers/auth.ts:15` contains a legacy JSDoc comment mentioning "using Kavenegar pattern lookup service". This is purely descriptive text and contains no executable code or imports.
2. **Database-Backed Worker Mechanism**: The queue worker executes in-process via Payload's `onInit` lifecycle on a 10-second polling interval against PostgreSQL (`sms-queue`). It intentionally does not introduce external message brokers (Redis/BullMQ), satisfying the "Complexity Must Pay Rent" invariant for the current architectural scale.

---

## 4. Conclusion

All items assigned in the dispatch are empirically confirmed and verified:
1. `pnpm --filter @persianpart/cms test:hardening` executes cleanly with **100 pass, 0 fail, 0 skipped**.
2. `pnpm --filter @persianpart/cms exec tsc --noEmit` exits with code `0`.
3. `apps/api` is 100% decoupled from Kavenegar (zero client code, zero dependencies, zero environment variables).
4. All 4 targeted technical debts (`TD-SEC-03`, `TD-SEC-08`, `TD-BE-09`, `TD-BE-06`) are fully resolved with concrete, robust code implementations in `apps/cms`.
5. Strict review-only guardrail was maintained (0 codebase files modified).

---

## 5. Verification Method

To independently reproduce and verify this assessment:

```bash
# 1. Execute CMS hardening test suite (verifies 100 tests pass)
pnpm --filter @persianpart/cms test:hardening

# 2. Execute CMS typecheck (verifies strict TypeScript compliance)
pnpm --filter @persianpart/cms exec tsc --noEmit

# 3. Verify absence of Kavenegar client in apps/api
test ! -f apps/api/src/lib/kavenegar.ts && echo "Kavenegar file correctly removed from apps/api"
grep -rn "kavenegar" apps/api/package.json || echo "No kavenegar dependency in apps/api"

# 4. Run API test suite to verify no regressions in API
pnpm --filter @persianpart/api test
```
