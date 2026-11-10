# BRIEFING — 2026-11-10T13:16:00Z

## Mission
Conduct a comprehensive multi-agent architectural, high-concurrency, OWASP security, and technical debt audit of PersianPart 2.0 (apps/api, apps/cms, apps/web, packages/contract) and produce TECHNICAL_DEBT_AND_AUDIT_REPORT.md with zero source code modifications.

## 🔒 My Identity
- Archetype: teamwork_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/orchestrator
- Original parent: parent (7dd0ae30-15d4-4f42-b12f-cfd3b61f4c58)
- Original parent conversation ID: 7dd0ae30-15d4-4f42-b12f-cfd3b61f4c58

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/orchestrator/PROJECT.md
1. **Decompose**:
   - Subtask 1: High-Concurrency & System Architecture Exploration (apps/api, apps/cms, PostgreSQL, Bun, connection pooling, cache, query performance).
   - Subtask 2: Security & OWASP Top 10 Vulnerability Audit (auth, OTP, JWT, CSRF/CORS, rate limiting, SQLi/injection, access control, secrets, trust boundaries).
   - Subtask 3: Frontend & Contract Architecture, Performance & Code-level Technical Debt (apps/web, packages/contract, state management, bundle size, hydration/rendering, UX/RTL).
   - Subtask 4: Technical Debt & Trade-off Compilation and Persian Report Generation (compiling all findings into TECHNICAL_DEBT_AND_AUDIT_REPORT.md).
   - Subtask 5: Forensic Audit & Reviewer verification of the report and zero-modification integrity check.
2. **Dispatch & Execute**:
   - Direct iteration loop using specialized Explorers, followed by Worker generation of TECHNICAL_DEBT_AND_AUDIT_REPORT.md, then Reviewer and Auditor checks.
3. **On failure**: Retry, replace, redesign.
4. **Succession**: At 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. High-concurrency & backend architecture analysis [in-progress]
  2. Security & OWASP Top 10 audit [in-progress]
  3. Frontend & contract technical debt & trade-offs [in-progress]
  4. Final report compilation (TECHNICAL_DEBT_AND_AUDIT_REPORT.md) [pending]
  5. Review & Forensic verification [pending]
- **Current phase**: 1
- **Current focus**: Parallel multi-agent deep exploration

## 🔒 Key Constraints
- ZERO modifications to existing source code, configuration, test files, or manifests in the repository.
- Single deliverable file: TECHNICAL_DEBT_AND_AUDIT_REPORT.md in project root.
- Report written in fluent Persian with standard English technical terminology.
- All claims must be grounded in concrete file paths, functions, and lines of code.

## Current Parent
- Conversation ID: 7dd0ae30-15d4-4f42-b12f-cfd3b61f4c58
- Updated: not yet

## Key Decisions Made
- Decompose into 3 parallel specialist Explorers (Backend/Concurrency, Security/OWASP, Frontend/Contracts/Debt) to maximize depth and speed without code modifications.
- Delegate final report synthesis to a specialized Worker who compiles the findings into TECHNICAL_DEBT_AND_AUDIT_REPORT.md in root.
- Dispatch Reviewer and Auditor for claim verification, rubrics, and git status integrity check.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_backend | teamwork_explorer | Backend Concurrency & DB Scalability | completed | 34172549-2fe7-4ef9-89fe-f9b3e90378c8 |
| explorer_security | teamwork_explorer | OWASP Top 10 Security Audit | completed | 454a8197-b12d-466b-8834-1a46a8b9ad14 |
| explorer_frontend | teamwork_explorer | Frontend & Contract Architecture Debt | completed | 34366fbc-5ea5-4013-9a49-45835e2879ac |
| worker_report | teamwork_worker | Synthesize TECHNICAL_DEBT_AND_AUDIT_REPORT.md | completed | b6304e74-616b-4a03-b387-fa0ba50d78b9 |
| reviewer_judge | teamwork_reviewer | Independent Agent-as-Judge Evaluation | completed | 973c2a4d-1e00-4df9-930f-9972c1f9dba2 |
| auditor_integrity | teamwork_auditor | Forensic Integrity & Git Status Verification | completed | a36b2652-9a7a-43aa-8aab-d51499ba36fb |

## Succession Status
- Succession required: no
- Spawn count: 6 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: none
- Safety timer: none

## Artifact Index
- /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/ORIGINAL_REQUEST.md — User request
- /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/orchestrator/DISPATCH.md — Orchestrator dispatch record
- /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/orchestrator/PROJECT.md — Scope and project plan
- /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/orchestrator/progress.md — Liveness & status log
- /Users/mm25zamanian/Codes/persianpartshop.ir/TECHNICAL_DEBT_AND_AUDIT_REPORT.md — Final deliverable
