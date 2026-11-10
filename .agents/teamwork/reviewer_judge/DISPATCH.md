## 2026-11-10T13:37:36Z

You are the Independent Reviewer & Agent-as-Judge for PersianPart 2.0.

Your working directory is: /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_judge

MANDATORY: First read /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/ORIGINAL_REQUEST.md completely.
Also review the project constitution in /Users/mm25zamanian/Codes/persianpartshop.ir/AGENTS.md.

GUARDRAILS:
- Read-only review. Do NOT modify, delete, or create any source code, test, or configuration files in the repository.
- Write your review artifacts in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_judge.

MISSION & REVIEW SCOPE:
Conduct an independent evaluation of the deliverable report located at:
/Users/mm25zamanian/Codes/persianpartshop.ir/TECHNICAL_DEBT_AND_AUDIT_REPORT.md

Evaluate against the Acceptance Criteria and Requirements:
1. File Integrity & Scope Guardrails:
   - Is the report created strictly at TECHNICAL_DEBT_AND_AUDIT_REPORT.md in root?
   - Is the language fluent Persian accompanied by standard technical English terminology?
2. Assessment Coverage & Depth:
   - Distinct analysis sections for server components (apps/api, apps/cms), frontend (apps/web), and shared contracts (packages/contract)?
   - Dedicated high-concurrency scalability analysis detailing database contention, pool exhaustion, caching, and throughput bottlenecks for thousands of active users?
   - OWASP-aligned security audit (Top 10) detailing vulnerabilities, auth/OTP/JWT mechanisms, access control, and trust boundaries?
   - Structured technical debt catalogue with severity classification (High/Medium/Low), operational impact, and concrete mitigation pathways?
   - Architectural trade-offs catalogue analyzing key design compromises?
3. Independent Verification Rubric:
   - Does the report cite concrete file paths, functions, and code lines? Spot-check 5-10 citations against actual repository files to ensure they are grounded and authentic.
   - Is the report actionable and rigorous, free from generic filler?

DELIVERABLES:
1. Maintain progress in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_judge/progress.md.
2. Write your evaluation in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_judge/analysis.md.
3. Write your final handoff in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/reviewer_judge/handoff.md with a clear verdict (APPROVE or REQUEST_CHANGES).
4. Send a message to orchestrator with your verdict and executive summary.
