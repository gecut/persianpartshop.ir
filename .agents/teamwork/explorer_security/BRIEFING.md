# BRIEFING — 2026-11-10T13:28:00Z

## Mission
Conduct an exhaustive OWASP Top 10 security audit across PersianPart 2.0 (apps/api, apps/cms, apps/web, packages/contract) and document all vulnerabilities, technical debts, and trade-offs.

## 🔒 My Identity
- Archetype: explorer
- Roles: Security & OWASP Top 10 Auditor
- Working directory: /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_security
- Original parent: d9727e7d-d864-4b61-a8fc-1a1433c1459a
- Milestone: Security Audit & Technical Debt Inventory

## 🔒 Key Constraints
- Read-only investigation — do NOT modify or create any code outside .agents/teamwork/explorer_security
- Ground every claim with exact file paths, line numbers, and concrete code analysis
- Cover OWASP Top 10 (A01-A10) + Technical Debt & Trade-offs catalog with severity ratings

## Current Parent
- Conversation ID: d9727e7d-d864-4b61-a8fc-1a1433c1459a
- Updated: 2026-11-10T13:28:00Z

## Investigation State
- **Explored paths**:
  - `apps/api/src/server.ts`, `apps/api/src/rpc/*`, `apps/api/src/routers/*`, `apps/api/src/lib/*`
  - `apps/cms/src/payload.config.ts`, `apps/cms/src/access/*`, `apps/cms/src/collections/*`, `apps/cms/src/endpoints/*`
  - `packages/contract/src/*`
  - `apps/web/vite.config.ts`, `apps/web/package.json`, `apps/web/src/modules/auth/*`, `apps/web/src/lib/*`
  - `docker-compose.yml`, root `package.json`
- **Key findings**:
  - Critical: Dynamic CORS reflection with `credentials: true` in `apps/api/src/server.ts:40-49`
  - Critical: Customer KYC identity documents public on CDN via `media` collection (`media.collection.ts:22`, `users.collection.ts:444`)
  - Critical: Live Kavenegar SMS API Key hardcoded in `apps/api/src/lib/kavenegar.ts:35` and `docker-compose.yml:41`
  - High: Plaintext OTP code stored in PostgreSQL (`otp.ts:73`, `otps.collection.ts:18`)
  - High: Missing IP-based rate limiting on OTP request (SMS bombing hazard)
  - High: In-memory token revocation Map (`jwt.ts:104`) with 30-day tokens
  - High: Stored XSS risk via SVG upload (`server.ts:109`)
  - High: Mock payment verification (`verifyPayment` in `shopping.ts:142`)
  - High: Double HTTP hop latency & socket exhaustion bottleneck
- **Unexplored areas**: None. Full 10 OWASP domains and technical debts catalogued.

## Key Decisions Made
- Fully documented all 10 OWASP Top 10 categories, Technical Debt Catalogue (15 items), Architectural Trade-Offs (4 items), and Remediation Plan in `analysis.md`.
- Produced 5-component handoff in `handoff.md`.

## Artifact Index
- `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_security/progress.md` — Progress tracker
- `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_security/analysis.md` — Comprehensive analysis report
- `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_security/handoff.md` — 5-component handoff report
