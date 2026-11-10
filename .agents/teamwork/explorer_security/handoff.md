# Handoff Report — Security & OWASP Top 10 Auditor

## 1. Observation
Direct, verifiable observations with exact file paths and code snippets:

- **Observation 1 (CORS Arbitrary Origin Reflection with Credentials):**
  - Path: `apps/api/src/server.ts:40-49`
  - Code:
    ```ts
    app.use(
      '*',
      cors({
        origin: (origin) => origin || '*',
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
        maxAge: 86400,
      })
    )
    ```
  - Docker Compose defines `CORS_ORIGINS` in `docker-compose.yml:40`, but `apps/api/src/server.ts` completely ignores it.

- **Observation 2 (KYC Confidential Documents Public Exposure):**
  - Path: `apps/cms/src/collections/users/users.collection.ts:444-451`
  - Code:
    ```ts
    name: "file",
    type: "upload",
    relationTo: "media",
    ```
  - Path: `apps/cms/src/collections/media/media.collection.ts:22`
  - Code:
    ```ts
    access: {
      read: () => true,
    ...
    ```
  - Path: `docker-compose.yml:134-137`
  - Code:
    ```yaml
    cdn:
      environment:
        NGINX_CORS_ORIGIN: "*"
      volumes:
        - persianpart_media_data:/data:ro
    ```

- **Observation 3 (Hardcoded Live Kavenegar SMS API Key & Log Leakage):**
  - Path: `apps/api/src/lib/kavenegar.ts:35-36` & `docker-compose.yml:41`
  - Code:
    ```ts
    const DEFAULT_API_KEY =
      '46437751615871547A59364B75376339706E72384266734A596F3476644B653641356171462F557A5747383D'
    ```
  - Path: `apps/api/src/lib/kavenegar.ts:94-99`
  - Code:
    ```ts
    console.error('[Kavenegar Error]', {
      endpoint, // contains https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json
      receptor: params.receptor,
      template,
      error: error?.message || error,
    })
    ```

- **Observation 4 (Plaintext OTP Storage & Superadmin Visibility):**
  - Path: `apps/api/src/lib/otp.ts:73, 87` & `apps/cms/src/collections/otps/otps.collection.ts:18, 60-67`
  - Code:
    ```ts
    // apps/api/src/lib/otp.ts:73
    data: { code, expiresAt, cooldownUntil, attempts: 0, user: userId }
    // apps/cms/src/collections/otps/otps.collection.ts:18
    access: { read: ({ req }) => isSuperAdmin({ req }) || isServiceAdmin({ req }) }
    name: 'code', type: 'text', label: 'کد تایید فعال'
    ```

- **Observation 5 (Absence of IP Rate Limiting & User Enumeration on OTP Endpoint):**
  - Path: `apps/api/src/routers/auth.ts:18-85`
  - Code: Cooldown is only checked per-phone (`now < cooldownTime`), no IP rate limiting middleware exists across `apps/api`. Unregistered phone numbers throw `403 FORBIDDEN` with explicit message "شماره همراه شما در سامانه ثبت نشده است", while registered numbers return 200.

- **Observation 6 (In-Memory Token Revocation Store & 30-Day Expiry):**
  - Path: `apps/api/src/lib/jwt.ts:22, 104`
  - Code:
    ```ts
    export const JWT_DEFAULT_EXPIRY_SECONDS = 30 * 24 * 60 * 60 // 30 days
    const revokedTokens = new Map<string, number>()
    ```

- **Observation 7 (Mock Payment Gateway Verification):**
  - Path: `apps/api/src/routers/shopping.ts:142-166`
  - Code:
    ```ts
    const verifyPayment = authed.shopping.verifyPayment.handler(async ({ input, context, errors }) => {
      // verifies order exists and belongs to user
      return { verified: true, message: 'سفارش معتبر و در حال پردازش است.', orderId: input.orderId }
    })
    ```

- **Observation 8 (Stored XSS Risk via SVG File Uploads):**
  - Path: `apps/api/src/server.ts:109`
  - Code:
    ```ts
    const safeExts = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.avif', '.pdf']
    ```
  - Served at `/api/media/*` with `Content-Type: file.type` without CSP or attachment disposition.

---

## 2. Logic Chain
Step-by-step reasoning from observations to conclusion:

1. **CORS Vulnerability Chain:**
   - In `apps/api/src/server.ts:43`, the origin resolver `(origin) => origin || '*'` dynamically mirrors the incoming request's `Origin` header.
   - Combined with `credentials: true` (line 46), any website visited by an authenticated user can perform authenticated requests with the user's cookies/credentials and read the response.
   - Therefore, sensitive customer profiles, pricing markup tiers, and order details can be exfiltrated via cross-origin web requests from malicious third-party origins (A05 / Broken Access Control).

2. **Customer KYC Data Leakage Chain:**
   - Business license scans and personal IDs uploaded in `Users` collection use the `media` collection relation (`users.collection.ts:444`).
   - The `media` collection specifies `access: { read: () => true }` (`media.collection.ts:22`).
   - Both `apps/api` (`server.ts:159`) and the NGINX CDN container (`docker-compose.yml:134-137`) serve `/data` and `/api/media/*` publicly with wildcard CORS.
   - Therefore, any unauthenticated actor can access and download private trade licenses, national identity scans, and business records without credentials (A01 / Information Disclosure).

3. **SMS Bombing and Credential Leakage Chain:**
   - In `kavenegar.ts:35-36`, the Kavenegar API key is hardcoded.
   - In `kavenegar.ts:94-99`, the error handler logs the full endpoint URL containing the API key and customer phone number to `console.error`.
   - In `auth.ts:18-85`, there is no IP-based rate limiting on `requestOtp`.
   - Therefore, an external attacker can automate mass OTP calls to drain SMS balance, while any network/delivery failure writes secret credentials and customer PII into server logs (A02, A07, A09).

4. **Authentication & Concurrency Bottleneck Chain:**
   - OTP codes are stored in plain text (`otp.ts:73`) and readable by superadmins in the CMS panel (`otps.collection.ts:18`).
   - Token revocation is stored in an in-memory `Map` in `apps/api/src/lib/jwt.ts:104`.
   - Under multiple container instances or process restarts, logout state is lost or out of sync across nodes.
   - `apps/api` queries Payload CMS over HTTP for almost every operation, creating a double HTTP hop and connection exhaustion under thousands of concurrent users (A04 / Scalability Debt).

---

## 3. Caveats
- **Live Penetration Testing:** In accordance with the project constitution and read-only investigation rules, no active exploit payloads or denial-of-service tests were executed against running staging/production instances.
- **Payload CMS Internal Framework Protections:** Payload CMS v3 provides built-in query parameter validation for its REST API, but since `apps/api` communicates via an administrative API key (`admins API-Key`), those access gates are superseded by the backend SDK.
- **Production Environment Overrides:** In a fully deployed environment, environment variables in a container runtime (e.g. Dokploy/Docker) might override the hardcoded fallbacks; however, the hardcoded defaults in source files remain committed in version control.

---

## 4. Conclusion
PersianPart 2.0 demonstrates robust transaction control and concurrency safety for inventory reservations in PostgreSQL (`FOR UPDATE`, `FOR SHARE`, and dead-lock resistant ID sorting). However, it exhibits significant security vulnerabilities across OWASP Top 10 categories that represent immediate risks for a high-concurrency production system with thousands of active business users.

The most critical issues requiring immediate remediation before production launch are:
1. **Fixing CORS configuration** in `apps/api/src/server.ts` to strictly whitelist origins from `process.env.CORS_ORIGINS`.
2. **Revoking the exposed Kavenegar API key**, eliminating the hardcoded key, and sanitizing error logs.
3. **Isolating customer verification documents** (`kyc-media` / `documents`) from the public `media` collection and removing them from public CDN routing.
4. **Hashing OTP codes** with SHA-256 in the database and increasing OTP length to 6 digits.
5. **Implementing distributed rate limiting and token revocation** backed by Redis.
6. **Replacing mock payment verification** (`verifyPayment`) with an authentic banking gateway integration.

---

## 5. Verification Method
Steps for an independent reviewer to verify these findings:

1. **Verify CORS Origin Reflection:**
   Inspect `apps/api/src/server.ts:41-48`. Notice that `origin` is a function `(origin) => origin || '*'` and `credentials: true`. Test with `curl`:
   ```bash
   curl -i -H "Origin: https://malicious-site.example.com" http://localhost:5175/health
   # Expected response header: Access-Control-Allow-Origin: https://malicious-site.example.com
   # Expected response header: Access-Control-Allow-Credentials: true
   ```

2. **Verify KYC Public Accessibility:**
   Inspect `apps/cms/src/collections/users/users.collection.ts:444` and `apps/cms/src/collections/media/media.collection.ts:22`. Note that `relationTo: "media"` is used for user documents and `media` has `read: () => true`.

3. **Verify Hardcoded Kavenegar Key:**
   Inspect `apps/api/src/lib/kavenegar.ts:35` and search for `'46437751615871547A59364B75376339706E72384266734A596F3476644B653641356171462F557A5747383D'`.

4. **Verify Plaintext OTP Storage:**
   Inspect `apps/api/src/lib/otp.ts:73` and `apps/cms/src/collections/otps/otps.collection.ts:60-67`. Observe `data: { code, ... }` without hashing.

5. **Verify In-Memory Revocation:**
   Inspect `apps/api/src/lib/jwt.ts:104`. Observe `const revokedTokens = new Map<string, number>()`.
