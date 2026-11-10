# Dispatch: Lead CTO Reviewer

## Objective
Execute the formal `/nexload-cto-review` skill to conduct an architectural and technical review of the centralized SMS module and database queue in `apps/cms`. Deliver the official review report with score, verdict, and findings strictly conforming to the `nexload-cto-review` standards.

## Working Directory
`/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_cto/`

## Domain Skill
Load and execute: `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/skills/nexload-cto-review/SKILL.md` and reference docs in that skill folder.

## Mandatory Rules & Guidelines
1. Review-Only constraint: DO NOT write code, generate patches, emit diffs, or provide step-by-step fix sequences.
2. Target mode: `readiness` & `implementation`.
3. 12-phase pipeline with Two-Pass Judgment:
   - Pass A: Requirement Fidelity (Did it solve the requested problem: decoupled SMS, P0 vs P1 priority separation, 9 templates, admin notifications, resolution of TD-SEC-03, TD-SEC-08, TD-BE-09, TD-BE-06?)
   - Pass B: Engineering Integrity (Architecture correctness, boundaries, Payload CMS collection design, queue worker concurrency & failure semantics, error handling, clean decoupling from apps/api).
4. Complexity Must Pay Rent:
   - Apply Three-Question Complexity Test to `sms-queue` DB collection vs external message broker (Redis/BullMQ/RabbitMQ).
   - Evaluate against AGENTS.md rule 1.5 ("Design strictly for Now + 1, NEVER for Now + 10").
5. Finding Admission Test & Root Cause Compression:
   - Max 3 material findings (P0/P1/P2) with required schema: Evidence anchor, Confidence, Impact, Why it matters, Required property, Verification condition, and optional Preserve.
   - Suppress stylistic, trivial, or unevidenced future-scale complaints.
6. Calibrated 6-Verdict Contract & Discrete Precision Score:
   - Discrete score from scale (10.0, 9.5, 9.0, 8.5, 8.0, 7.5, 7.0, 6.5, 6.0, 5.0, 4.0, 2.0, 0.0).
   - Authoritative verdict (`Approved`, `Approved with minor issues`, `Needs revision`, `Blocked`, `Rejected`, `Withheld`).
7. Deliver full report to `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_cto/handoff.md` and `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_cto/CTO_REVIEW_REPORT.md`.


## 2026-11-10T21:01:44Z
You are the Lead CTO Architectural Reviewer executing the `/nexload-cto-review` skill.
Your working directory is /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_cto/.

Load and strictly follow the skill at:
- `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/skills/nexload-cto-review/SKILL.md`
- `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/skills/nexload-cto-review/references/priority-verdict-and-output.md`
- `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/skills/nexload-cto-review/references/architecture-and-decision-lenses.md`
- `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/skills/nexload-cto-review/references/scope-evidence-and-review-contract.md`

Input documents:
- `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_cto/DISPATCH.md`
- `/Users/mm25zamanian/Codes/persianpartshop.ir/TECHNICAL_DEBT_AND_AUDIT_REPORT.md`
- `/Users/mm25zamanian/.gemini/antigravity/brain/d1084158-6e00-40e8-8dce-810e4134372b/walkthrough.md`

Target Scope:
Centralized SMS module and database queue in `apps/cms`:
- `apps/cms/src/modules/sms/` (kavenegar-client, queue-worker, templates, dispatcher)
- `apps/cms/src/collections/otps.ts` (P0 OTP synchronous blocking hook)
- `apps/cms/src/collections/sms-queue.ts` (P1 persistent queue collection)
- `apps/cms/src/globals/notification-settings.ts` (admin phone numbers)
- Decoupling verification from `apps/api`

Deliverables:
Perform the 12-phase CTO review:
1. Two-pass judgment (Pass A: Requirement fidelity, Pass B: Engineering integrity)
2. Three-question complexity test ('Complexity Must Pay Rent' vs Redis/RabbitMQ)
3. Technical debt resolution check (TD-SEC-03, TD-SEC-08, TD-BE-09, TD-BE-06)
4. Production readiness evaluation
5. Finding admission test & root-cause compression (max 3 material findings, or 0 if clean)
6. Discrete score (e.g., 9.0, 9.5, 10.0) and 6-verdict contract (Approved / Approved with minor issues / Needs revision / Blocked / Rejected / Withheld)
7. Strictly Review-Only: NO code snippets, NO patch files, NO shell commands.
Write the full official report in Persian with standard technical English terminology to `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_cto/CTO_REVIEW_REPORT.md` and your summary to `handoff.md`.
