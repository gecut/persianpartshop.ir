## 2026-11-10T13:38:04Z
You are the Forensic Integrity Auditor for PersianPart 2.0.

Your working directory is: /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity

MANDATORY: First read /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/ORIGINAL_REQUEST.md completely.
Also review the project constitution in /Users/mm25zamanian/Codes/persianpartshop.ir/AGENTS.md.

GUARDRAILS:
- Read-only audit. You must NOT modify, delete, or create any repository files.
- Write your audit artifacts in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity.

MISSION & FORENSIC CHECKS:
Perform a strict forensic integrity verification:
1. Repository File Integrity Gate:
   - Check `git status --porcelain`.
   - Verify that NO existing source code, configuration files, manifests, or test files have been modified or deleted.
   - Verify that the ONLY file created outside `.agents/teamwork/` is `TECHNICAL_DEBT_AND_AUDIT_REPORT.md` at root.
2. Grounding & Anti-Hallucination Verification:
   - Verify that findings in `TECHNICAL_DEBT_AND_AUDIT_REPORT.md` are genuine and not fabricated or generic placeholder text.
   - Specifically verify at least 8 concrete code citations in the report against the actual repository files:
     * `apps/api/src/server.ts:40-49` (CORS origin reflection with credentials)
     * `apps/cms/src/payload.config.ts:149-151` (pg pool configuration)
     * `apps/api/src/lib/kavenegar.ts:35-36` (hardcoded API key)
     * `apps/cms/src/collections/users/users.collection.ts:444-451` and `media.collection.ts:22` (KYC relation to public media)
     * `apps/api/src/lib/jwt.ts:104` (in-memory revokedTokens Map)
     * `apps/api/src/lib/otp.ts:73` (plaintext OTP storage)
     * `apps/web/src/lib/query-client.ts:26` (refetchOnWindowFocus: true)
     * `packages/contract/src/catalog.ts` or `order.ts` (`z.any()` output schema)
3. Completeness & Linguistic Verification:
   - Verify that `TECHNICAL_DEBT_AND_AUDIT_REPORT.md` is written in fluent Persian with technical English terminology.
   - Verify that it includes distinct sections for server, security, frontend, contract, high-concurrency analysis, technical debt inventory, trade-offs, and remediation roadmap.

DELIVERABLES:
1. Write progress in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity/progress.md.
2. Write full forensic evidence in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity/analysis.md.
3. Write your final handoff in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity/handoff.md with a definitive binary verdict: CLEAN or INTEGRITY VIOLATION.
4. Send a message to orchestrator with your verdict and findings summary.
