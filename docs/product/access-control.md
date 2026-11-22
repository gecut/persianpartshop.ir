# 04 — Roles, access boundaries and audit

Reviewed: 2026-11-22. This describes implemented access, not a security certification.

## Identity layers

CMS `admins` has selectable roles `superadmin`, `manager`, `support` and `service`, gated by `isActive`. Customers live in `users` and authenticate to the API as `customer`. The API's `adminOnly` middleware checks role strings `admin`/`superadmin`; it is not identical to the CMS `manager` permission model. Do not assume every CMS role can call every administrative RPC.

The admin field offers `support`; legacy helpers also recognize `editor`, which is not currently selectable. Warehouse and operational-price guards exclude both.

## Business roles mapped to system roles

| Business actor | System identity | Notes |
| --- | --- | --- |
| Sales representative (customer) | `users`, OTP login | Staff-created; documents verified manually by an admin. |
| Support / sales staff | `support` | Reads/updates orders and supply-request statuses; cannot create orders. Is the party who needs to know whether an order is still inside the 60-minute customer-cancel window ([02 R7](business-rules.md)); the CMS does not show this yet. |
| Operations manager | `manager` | Catalog, prices, warehouses, plans, CSV apply. |
| Owner/administrator | `superadmin` | Everything above plus staff roles, customer types, audit logs. |
| Accountant | none dedicated `[UNKNOWN]` | Produces the Kimia export; which staff account applies it is not recorded. Apply requires `manager` or `superadmin`. |
| Integration | `service` | API's CMS identity; writes orders and customers. |

Beta observation (2026-11-22): 8 customers, all `active`; no customer is `pending` or `suspended`, so hold-state access paths are code-verified only.

## CMS matrix for current selectable roles

| Operation | manager | superadmin | support | service |
| --- | --- | --- | --- | --- |
| Product/media content create/update/delete | Yes | Yes | No | Yes |
| Product base-price create/update | Yes | Yes | No | No |
| Read raw product records | Yes | Yes | Yes | Yes |
| Read Catalog Global | Yes | Yes | No | Yes |
| Edit/version/preview Catalog Global | Yes | Yes | No | No |
| Read customers | Yes | Yes | Yes | Yes |
| Create/update customers | Yes | Yes | No | Yes |
| Delete customers | No | Yes | No | No |
| Read/update orders within lifecycle guards | Yes | Yes | Yes | Yes |
| Create orders | Yes | Yes | No | Yes |
| Delete orders | No | No | No | No |
| Read warehouses | Yes | Yes | Yes | Yes |
| Read warehouse balances | Yes | Yes | No | Yes |
| Create/update warehouses and sources | Yes | Yes | No | No |
| Create balance; CSV preview/apply/export | Yes | Yes | No | No |
| Change balance amount/revision directly; delete balance | No | No | No | No |
| Edit balance activity/report metadata | Yes | Yes | No | No |
| Delete warehouse | No | No | No | No |
| Create/update plans | Yes | Yes | No | No |
| Change customer-tier definitions | No | Yes | No | No |
| Create/manage staff roles | No | Yes | No | No |
| Read/delete audit logs | No | Yes | No | No |

Support may also read customer-tier definitions. Admin/customer synchronization requires an explicit unique account link; a matching phone alone never links or changes an existing customer. Deactivation suspends the linked customer, but reactivation remains manual. Staff can read/update their own admin record under the self-access rule; role changes are separately superadmin-only. Server Local API operations default to bypassing collection access, so hooks and internal callers must be considered separately from REST/UI permissions. Service writes orders, which invoke controlled reserve/restore operations; denial of direct balance writes does not prevent that workflow.

Sources: [admin collection](../../apps/cms/src/collections/admins/admins.collection.ts), [users](../../apps/cms/src/collections/users/users.collection.ts), [products](../../apps/cms/src/collections/products/products.collection.ts), [product price guard](../../apps/cms/src/collections/products/_product-access.ts), [warehouses](../../apps/cms/src/collections/warehouses/warehouses.collection.ts), [balances](../../apps/cms/src/collections/warehouse-stock/warehouse-stock.collection.ts).

## Customer API boundaries

Supply preview and submission require an active customer with ordering and category access. An active customer retains access to their own request history and eligible cancellation after ordering access is removed. Managers and superadmins manage sources; managers, superadmins and support manage request statuses. The service account is the technical CMS boundary for customer creation and cancellation.

Order access is owner-scoped; unauthorized order lookup returns `NOT_FOUND` to avoid enumeration. Submit/availability require authentication, ordering permission and allowed categories. `hideExactStock` converts catalog quantities to availability hints and also disables ordering. `disableOrdering` independently blocks ordering. A failed customer-permission lookup returns an error instead of permissive defaults for a known customer ID.

`canUseProductQr` enables QR lookup and QR payload retrieval for the authenticated customer account. Both operations check the current permission and the product's active status and allowed category. QR access does not grant ordering. The CMS field is editable only by authorized user managers; customers cannot grant it to themselves. The raw scan code is removed from ordinary catalog, populated plan and order responses.

Catalog/shopping mappings remove wholesale base price and apply customer markup. Order mapping strips specified internal fields; this is not proof that every field on every API/REST path is confidential. In particular:

- Raw product reads require an active staff/service identity. Anonymous and customer direct CMS reads are denied; customers use their authenticated API. Catalog/shopping legacy product procedures now require authentication without changing their schemas.
- Catalog's anonymous renderer receives only a saved-policy projection. Its server uses `@payloadcms/sdk` directly against CMS with the existing active admins service API key; browser credentials never become its CMS identity. CMS `/api/catalog/:operation` enforces the existing role and sanitizes DTOs. Preview runs locally in CMS with the actual active manager/superadmin session, without a separate secret or API bridge. Admin roles/API-key authentication and generic guards are unchanged; the API `adminOnly` middleware is not reused.
- The server CORS middleware reflects request origin; configured Compose `CORS_ORIGINS` is not itself evidence of an enforced allowlist.

These changes were verified in a disposable local environment on 2026-11-18. Shared-environment deployment is [UNKNOWN] and requires separate owner approval for the ACL change. See [Catalog rollout and consumer inventory](../architecture/public-catalog.md).

## Audit

[AuditLogs](../../apps/cms/src/collections/audit-logs/audit-logs.collection.ts) stores action/entity/target/details plus admin/name/IP/timestamps. Hooks record events for admins, products, users and plans; order status transitions also have their embedded timeline. Successful stock CSV apply writes an audit record in its stock transaction. Do not claim universal before/after snapshots or every order transition in AuditLogs without a matching hook.

Normal audit create/update is denied; internal server hooks write records. Superadmin can read and delete audit records. The [generic logger](../../apps/cms/src/collections/audit-logs/log-action.ts) catches write failures; therefore not every generic audit write is a guaranteed business-transaction invariant. Stock CSV's explicit audit write is transactional.
