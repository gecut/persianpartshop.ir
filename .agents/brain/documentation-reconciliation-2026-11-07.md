# Documentation reconciliation — 2026-11-07

## Scope and result

The current maintained set is README + docs/README + documents 00–07 + operational CSV example. AGENTS governs agent work. Brain plans/handoffs are historical decision/execution artifacts, not the current application specification. Generated `.enola` maps remain local tool output and are not accepted as source evidence.

The existing source/warehouse integration was committed as `a623685`; the pre-existing agent skill/instruction changes as `15121bf`. No push was requested or performed. This documentation pass changes prose/comments only, not application behavior, database state or deployment.

## Evidence audit and disposition

| Former claim | Source evidence / actual state | Documentation disposition |
| --- | --- | --- |
| Entire catalog is private | web root redirects, catalog uses base; CMS products read is public | Preserve B2B intent; explicitly document the unenforced API/CMS boundary |
| Customer/Support/Admin matrix | admin options: superadmin/manager/service; legacy helpers still recognize support/editor | Replace matrix with actual selectable roles, retain legacy discrepancy |
| All IDs are UUIDs | generated Payload types use numeric IDs | Distinguish persisted IDs from boundary strings |
| Every product is a tile | productType tile/other and selling factor helper | Document primary units and secondary metadata separately |
| Product stock is operational source | warehouse-stock collection and reserve/restore helpers | Replace ownership model and add warehouse relations |
| Tier/markup/name/SKU fully snapshotted | item collection persists final amounts/type/unit/factor; name/SKU preparation keys have no collection fields | Document exact persisted snapshot; no full-history claim |
| Preparing/ready lifecycle and automatic transition at deadline | CMS transition hook supports pending/approve/completed/cancel states; web derives review display | Replace state machine; distinguish UI projection from persisted state |
| Cancellation time is configurable/old 30-minute rule | API and web use 60 minutes | Document settled 60-minute rule, not a fictitious settings endpoint |
| Reorder edits/reactivates original order | new draft and submit, fresh warehouse, active-cart guard | Document new-order workflow |
| Single price+inventory CSV | price plugin and separate warehouse endpoints | Split workflows/limits/guarantees; no stock-preview promise for price plugin |
| Persistent ImportRun, anomaly scoring or auto reversal | no custom model/handler for those capabilities | Remove descriptions of implemented features |
| Plan tier targeting/tenor/interest fields | title/content/users/products/start/expiry/isActive | Replace hypothetical finance schema; no automatic discount math |
| Audit is immutable to all actors and universally atomic | superadmin delete allowed; generic logAction catches errors; stock CSV write is transactional | Describe actual coverage and guarantees |
| API calls in-process CMS engine | runtime data uses Payload REST SDK | Correct runtime diagram and service identity |
| system router/getBySlug/cancelByCustomer exist | root contract exports actual routers and procedure names | Remove invented API surface and stale comment |
| Strict outputs everywhere | several legacy z.any outputs remain | Record strictness limits instead of overstating type safety |
| Compose supplies PostgreSQL | only migration/api/cms/web/cdn services are defined | Document external database prerequisite |
| prodMigrations proves zero downtime | configured, but warehouse cutover rejects nonempty orders | Document configuration and deployment blocker separately |
| SVG/size claims from old media diagram | CMS MIME list JPEG/PNG/WebP/AVIF; limits vary by route | Link source, remove unsupported universal upload assertions |
| Fresh repository has no API suites | warehouse unit and opt-in live suites exist | Update AGENTS test pointer |

## Preserved session decisions

Shared prices across warehouses; independent balances; one warehouse per cart/order; zero/one/multiple selection behavior; preserve draft on failure; account/browser isolation; sellable stock after reservations in CSV; manager/superadmin stock administration; custom orders disabled; 60-minute cancellation; tile carton math and other products in primary units. Current other-unit ordering rounds to whole units, including kg/liter; fractional sales are not claimed.

## Remaining implementation gaps, not resolved by prose

1. Private-catalog intent is broader than current public API/CMS read guards. CORS reflects origin; Compose setting alone is not an enforced allowlist.
2. Historical product name/SKU and tier/markup are not a complete durable order-item snapshot. Quantity/final prices/type/unit/factor are persisted; product metadata may come from the current populated product.
3. Legacy role helpers, permissive DTOs and old source naming remain; this review identifies them without silently altering runtime contracts.
4. Existing nonempty order history needs explicit warehouse allocation before the warehouse cutover migration. Working database migration and deployment remain outside this documentation update.

These findings are traceable to linked source in the maintained docs; they do not reopen user-approved warehouse decisions. Future remediation requires its own implementation scope.

## Verification

Read manifests, contract root, API auth/catalog/shopping/order/plan handlers, CMS collections/access/hooks/migrations, client selection/order stores, Compose and media definitions. Validated 56 local file targets across 11 documents with no missing targets; checked for stale API names/old state machines in maintained docs. Diff whitespace check passed. No application tests are rerun for prose/comment-only changes; runtime evidence remains the dated merge verification report.
