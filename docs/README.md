# Documentation scope and authority

Reviewed: 2026-11-07 (Asia/Tehran).

## Maintained documents

| Document | Owns |
| --- | --- |
| [00 — Overview](00-overview.md) | Product intent, supported capabilities, exclusions |
| [01 — Models](01-domain-models.md) | Actual persistence and distinctions from DTOs |
| [02 — Rules](02-business-rules.md) | Units, pricing, stock, binding, retry, cancellation |
| [03 — Flows](03-system-flows.md) | Authentication, lifecycle and operational sequences |
| [04 — Permissions](04-roles-and-permissions.md) | Implemented roles, access boundaries, audit coverage |
| [05 — Architecture](05-architecture-and-contracts.md) | Runtime ownership, real contract surface, deployment configuration |
| [06 — Operations](06-admin-and-operations.md) | Administration, CSV, migration/seed and verification commands |
| [07 — Warehouses](07-warehouses.md) | Warehouse decision record and detailed operational contract |
| [08 — PWA](08-pwa.md) | Installation, offline shell, drafts, upgrades and browser verification |
| [CSV example](examples/warehouse-stock.csv) | Stock import syntax only; not actual stock data |

Keep a rule in its owning document and link elsewhere. In particular document 07 preserves the warehouse decisions, while model/rule/runbook documents describe their current implementation without contradictory fallback banners.

## Authority and evidence

Runtime observations outrank code/config, official documentation, project prose and inference. User-approved decisions define intended constraints; where code falls short, document the gap rather than rewriting the decision as if it had changed. `[UNKNOWN]` identifies an unverified fact, not an implemented feature. Do not use plans, generated code maps or a commit title as proof that a feature works or is deployed.

`AGENTS.md` governs agent operations. Contracts in `packages/contract` own API shapes; CMS collection definitions own persistence/access; manifests and Compose own configured tooling/topology. Source links in each document make claims traceable without copying complete schemas into prose.

## Historical and generated material

`.agents/brain/` contains plans, handoffs, analyses and dated execution records. Preserve their original decisions/history; a completed handoff is not current working state. Read the dated [merge verification](../.agents/brain/warehouse-merge-completion-2026-11-07.md) with its environment and limitations. The [documentation reconciliation](../.agents/brain/documentation-reconciliation-2026-11-07.md) records this review's discrepancies and disposition.

`.enola/` contains generated repository-analysis snapshots, including references to earlier source/skills. It is not a maintained source of product truth. Regenerate when using that tool; this review does not silently rewrite its provenance. Removed `.kilo/plans` paths are not active documentation references.

## Update discipline

A behavior change updates the owning rule/model/flow and any affected runbook. Distinguish persisted state from UI projection, customer DTO from CMS record, configured deployment from observed deployment, and a skipped test from an executed pass. Record the date and source pointers. Keep credentials, production identifiers and environment secrets out of examples.
