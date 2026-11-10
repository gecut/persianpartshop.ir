# Project: PersianPart 2.0 Comprehensive Architecture, Security & Technical Debt Audit

## Architecture Overview
PersianPart 2.0 is a monorepo e-commerce platform:
- `apps/api`: Hono + oRPC on Bun runtime, Kavenegar SMS, JWT/OTP, PostgreSQL (`pg`), Payload SDK.
- `apps/cms`: Payload CMS v3 on Next.js + PostgreSQL.
- `apps/web`: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS v4 + HeroUI v3.
- `packages/contract`: oRPC contract (`oc`) + Zod definitions.

## Objectives & Non-Negotiable Boundaries
- Scenario: Several thousand active concurrent users (high load, high traffic e-commerce).
- Target areas:
  1. High concurrency scalability & system bottlenecks (DB pool, locking, caching, worker processes, queues).
  2. Security & OWASP Top 10 vulnerability audit (auth, OTP, JWT, CSRF/CORS, rate limiting, SQLi/injection, access control, secrets, trust boundaries).
  3. Technical debt & trade-off catalogue (code organization, state management, bundle/asset delivery, error handling, maintainability, architectural trade-offs).
- Output: Strict report-only output at `/Users/mm25zamanian/Codes/persianpartshop.ir/TECHNICAL_DEBT_AND_AUDIT_REPORT.md` written in fluent Persian with technical English terms.
- Zero code modifications to existing files (`git status --porcelain` must be clean aside from the report).

## Planned Milestones & Roles
| # | Milestone | Assigned Agent | Status | Output Artifact |
|---|-----------|----------------|--------|-----------------|
| 1 | Survey & Backend Concurrency Investigation | teamwork_explorer (explorer_backend) | DONE | `.agents/teamwork/explorer_backend/analysis.md` |
| 2 | OWASP Top 10 & Security Vulnerability Audit | teamwork_explorer (explorer_security) | DONE | `.agents/teamwork/explorer_security/analysis.md` |
| 3 | Frontend, Contract & Code Debt Investigation | teamwork_explorer (explorer_frontend) | DONE | `.agents/teamwork/explorer_frontend/analysis.md` |
| 4 | Technical Debt Synthesis & Final Report Assembly | teamwork_worker (worker_report) | DONE | `TECHNICAL_DEBT_AND_AUDIT_REPORT.md` |
| 5 | Peer Review & Rubric Evaluation | teamwork_reviewer (reviewer_judge) | DONE | `.agents/teamwork/reviewer_judge/handoff.md` |
| 6 | Forensic Integrity Audit & Git Status Verification | teamwork_auditor (auditor_integrity) | DONE | `.agents/teamwork/auditor_integrity/handoff.md` |
