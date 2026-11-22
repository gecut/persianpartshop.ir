# Documentation index and authority

Reviewed: 2026-11-22 (Asia/Tehran). Audience: LLM agents; humans read through an agent. Text is English with Persian terms and examples.

## Where to look

| Question | Read | Folder |
| --- | --- | --- |
| What is this system, who uses it, what is out of scope? | [overview](product/overview.md) | `product/` |
| What does each stored entity and Persian term mean? | [domain models](product/domain-models.md) | `product/` |
| What are the rules (prices, rounding, stock, cancel, import) and why? | [business rules](product/business-rules.md) | `product/` |
| How do auth, ordering, cancellation, daily import flow? | [flows](product/flows.md) | `product/` |
| Who may do what? | [access control](product/access-control.md) | `product/` |
| How is it built and deployed (runtime, contract, Compose)? | [system architecture](architecture/system-architecture.md) | `architecture/` |
| Why do CMS hooks reject or accept a change? | [CMS integrity](architecture/cms-integrity.md) | `architecture/` |
| Install, offline, drafts, upgrades | [PWA](architecture/pwa.md) | `architecture/` |
| Public catalog policy, ISR, rollout | [public catalog](architecture/public-catalog.md) | `architecture/` |
| How do I run, import, migrate, seed, connect MCP? | [runbook](operations/runbook.md) | `operations/` |
| How must products be named and created? (**binding for catalog writes**) | [catalog product standard](standards/catalog-product-standard.md) | `standards/` |
| How is `ts-pattern` used in `apps/web`? | [frontend ts-pattern](standards/frontend-ts-pattern.md) | `standards/` |

Reading order for a new agent: overview → business rules → domain models → flows. Add the architecture/operations files only when the task touches them.

## Authority

1. Runtime observation > code/config > official docs > these docs > inference ([AGENTS.md](../AGENTS.md) §1.1). `[UNKNOWN]` marks an unverified fact; `[ASSUMPTION]` marks an unverified judgment.
2. Business facts (why a rule exists) come from the product owner. Quoting beta data must name the environment: beta is not production.
3. Contracts in `packages/contract` own API shapes; CMS collection definitions own persistence and access; manifests and Compose own configured topology. Docs link to sources instead of copying schemas.
4. A plan, generated code map, or commit title is not proof that a feature works or is deployed.

## Document conventions

- One rule lives in one file; others link to it. Business rules carry **Rule / Why / Example** and a stable id (`R1`…); cite as `business-rules.md R7`.
- Distinguish persisted state from UI projection, customer DTO from CMS record, configured from observed deployment, skipped test from executed pass.
- No credentials, tokens or production identifiers in docs or examples.
- Each file starts with `Reviewed: <date>`; update it when you change the file.

## Historical and generated material (not maintained docs)

- `.agents/brain/` holds dated plans, handoffs and execution reports. Preserve them. They link to the **old numbered paths**; use the map below.
- `.enola/` holds generated analysis snapshots and is not a source of product truth.

| Old path | New path |
| --- | --- |
| `00-overview.md` | `product/overview.md` |
| `01-domain-models.md` | `product/domain-models.md` |
| `02-business-rules.md` | `product/business-rules.md` |
| `03-system-flows.md` | `product/flows.md` |
| `04-roles-and-permissions.md` | `product/access-control.md` |
| `05-architecture-and-contracts.md` | `architecture/system-architecture.md` |
| `06-admin-and-operations.md` | `operations/runbook.md` |
| `07-warehouses.md` | merged into `product/business-rules.md` (R4, R14) and `operations/runbook.md` |
| `08-pwa.md` | `architecture/pwa.md` |
| `09-hook-integrity.md` | `architecture/cms-integrity.md` |
| `10-ts-pattern-standard.md` | `standards/frontend-ts-pattern.md` |
| `11-product-creation-standards.md` | `standards/catalog-product-standard.md` |
| `12-public-catalog.md` | `architecture/public-catalog.md` |
| `13-maintenance-audit.md` | removed (stale generated snapshot; see git history) |
| `llm-only.md` | removed (invariants live in the catalog product standard and business rules) |

## Update discipline

A behavior change updates the owning rule/model/flow and any affected runbook step in the same commit. Record the date and source pointers.
