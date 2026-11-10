# Original User Request

## Initial Request — 2026-11-10T13:13:43Z

اینکارو باید با یه تیم متخصص که انواع زیر عامل ها از جمله زیر عامل های متخصص امنیت و OWASP دارن بررسی کنی. پروژه را با فرض چندین هزار کاربر فعال و یک مجموعه بسیار بزرگ به طور کامل تحلیل کنید، تک به تک قسمت‌ها و ماژول‌ها را چه در سمت سرور و چه در سمت فرانت‌اند و ماژول‌های وابسته بررسی نمایید، و یک فهرست کامل از بدهی‌های فنی (Technical Debt) و موازنه‌ها (Trade-off) را در قالب یک گزارش Markdown ارائه دهید.

Working directory: /Users/mm25zamanian/Codes/persianpartshop.ir
Integrity mode: development

## Requirements

### R1. Comprehensive Architecture and Code Analysis
Perform a detailed, module-by-module architectural and code inspection across all server-side (`apps/api`, `apps/cms`), frontend (`apps/web`), and shared contract packages (`packages/contract`), specifically evaluating system behavior and bottlenecks under a scenario of several thousand active concurrent users.

### R2. Security and OWASP Vulnerability Audit
Conduct an in-depth security audit across the entire repository following OWASP Top 10 standards, evaluating authentication/authorization mechanisms (JWT, OTP, session management), input validation, trust boundaries, and dependency vulnerabilities.

### R3. Technical Debt and Trade-Off Catalogue
Compile a structured catalogue identifying technical debts and architectural trade-offs that the system currently incurs or will face in the near future and post-production scaling, including severity ratings, potential operational impact, and recommended remediations.

### R4. Strict Report-Only Output and Zero Code Modifications
Deliver all findings solely within a single comprehensive Markdown file saved at `TECHNICAL_DEBT_AND_AUDIT_REPORT.md` in the project root. The report must be written in Persian with standard technical English terminology. The team must NOT modify, delete, or create any source code, test, or configuration files in the repository.

## Acceptance Criteria

### File Integrity & Scope Guardrails
- [ ] No existing source code, configuration, test files, or manifests in the repository are modified or deleted (`git status --porcelain` reflects no changes to existing files).
- [ ] The report file is created strictly at the root path `TECHNICAL_DEBT_AND_AUDIT_REPORT.md`.
- [ ] The report content is written in fluent Persian accompanied by standard English technical terminology.

### Assessment Coverage & Structure
- [ ] The report contains distinct analysis sections for server components (`apps/api`, `apps/cms`), frontend components (`apps/web`), and shared contracts (`packages/contract`).
- [ ] The report includes a dedicated high-concurrency scalability analysis detailing database contention, caching, and throughput bottlenecks for thousands of active users.
- [ ] The report includes an OWASP-aligned security audit detailing potential vulnerabilities and security trade-offs.
- [ ] The technical debt section provides a structured inventory with severity classification (High/Medium/Low), operational impact, and mitigation pathways.

### Independent Verification Rubric
- [ ] An independent agent-as-judge verifies that the report satisfies all coverage requirements, cites concrete file paths and code constructs, and contains actionable, grounded evaluations without generic filler.
