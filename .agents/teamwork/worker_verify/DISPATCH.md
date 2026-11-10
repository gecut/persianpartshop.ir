# Dispatch: Empirical Verification Worker

## Objective
Execute factual verification of unit tests, typechecks, and technical debt closures for the centralized SMS module in apps/cms.

## Working Directory
`/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/worker_verify/`

## Requirements to Verify
1. Execute `pnpm --filter @persianpart/cms test:hardening` and capture the exact output and test counts (confirming 100 passing unit tests with 0 failures without external live dependencies).
2. Execute `pnpm --filter @persianpart/cms exec tsc --noEmit` to verify typecheck.
3. Verify 100% decoupling of Kavenegar from `apps/api`:
   - Inspect `apps/api/package.json` (no kavenegar dependency).
   - Check `apps/api/src/` for any lingering references or keys.
4. Verify closure of the 4 technical debts from `TECHNICAL_DEBT_AND_AUDIT_REPORT.md` with exact file + line evidence:
   - `TD-SEC-03`
   - `TD-SEC-08`
   - `TD-BE-09`
   - `TD-BE-06`
5. Report findings in `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/worker_verify/handoff.md`.

## Mandatory Guardrail
DO NOT MODIFY OR PATCH ANY SOURCE CODE. This task is purely verification and test execution.

## 2026-11-10T21:01:25Z
You are assigned to verify the test suite, build/typecheck status, and code evidence for the SMS module in apps/cms.
Your working directory is /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/worker_verify/.
Read:
- /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/worker_verify/DISPATCH.md
- /Users/mm25zamanian/Codes/persianpartshop.ir/TECHNICAL_DEBT_AND_AUDIT_REPORT.md
- /Users/mm25zamanian/.gemini/antigravity/brain/d1084158-6e00-40e8-8dce-810e4134372b/walkthrough.md

Tasks:
1. Run `pnpm --filter @persianpart/cms test:hardening` and capture the exact summary, confirming all 100 tests pass without failures or external live service dependencies.
2. Run `pnpm --filter @persianpart/cms exec tsc --noEmit` to verify typecheck.
3. Check `apps/api/package.json` and grep `apps/api/src/` to confirm 100% removal of Kavenegar client, keys, and dependencies from `apps/api`.
4. Inspect the code in `apps/cms` to verify the resolution of the 4 technical debts:
   - TD-SEC-03: Kavenegar credentials/client securely located in CMS only (`apps/cms/src/modules/sms/kavenegar-client.ts`).
   - TD-SEC-08: Secure OTP generation & blocking delivery in `otps` collection (`apps/cms/src/collections/otps.ts` beforeChange hook).
   - TD-BE-09: Persistent queue collection `sms-queue` (`apps/cms/src/collections/sms-queue.ts`) and background worker (`apps/cms/src/modules/sms/queue-worker.ts`) with retry mechanics.
   - TD-BE-06: 9 approved production templates in `apps/cms/src/modules/sms/templates.ts` and `notification-settings` global (`apps/cms/src/globals/notification-settings.ts`).
5. Write your complete handoff report to `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/worker_verify/handoff.md`.
GUARDRAIL: Strictly Review/Verify-Only. Do NOT modify, patch, or write any source code files.
