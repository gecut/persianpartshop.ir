# 04 — Roles, Permissions & Security Matrix

This document defines user access control, authorization boundaries, privilege separation, and audit policies across PersianPart 2.0.

---

## 1. Actor Hierarchy & Role Taxonomy

The system defines three distinct operational roles. Customer identity is logically separated from internal staff:

```
                  ┌──────────────────────┐
                  │        Admin         │ (Full Governance & Oversight)
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │       Support        │ (Daily Operations & Catalog Enrichment)
                  └──────────────────────┘

       ═════════════════ Security Boundary ═════════════════

                  ┌──────────────────────┐
                  │       Customer       │ (External Authenticated B2B Buyer)
                  └──────────────────────┘
```

1. **`Customer` (External Trade Buyer)**:
   - Authenticated exclusively via SMS OTP.
   - Restricted strictly to tenant-scoped reads and self-authored transactions.
   - Zero access to administrative control panels, raw pricing markups, or other customers' records.

2. **`Support` (Internal Operations Staff)**:
   - Authenticated via email/password through the internal administration portal.
   - Manages day-to-day customer onboarding, catalog enrichment, order reviews, and CSV sync execution.
   - Restricted from altering pricing policies, managing system credentials, or mutating audit trails.

3. **`Admin` (Internal Supervisor)**:
   - Complete system authority.
   - Configures pricing tiers, customer markup percentages, staff accounts, and global commerce parameters.
   - Inspects immutable audit trails and system telemetry.

---

## 2. Comprehensive Permissions Matrix

| Domain / Resource | Action | Customer | Support | Admin | Enforcement Mechanism |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Catalog Products** | Read Active Products | Allowed (Self Tier) | Allowed | Allowed | Server API / Scoped Query |
| | Create / Edit Content | Denied | Allowed | Allowed | Admin Portal Access Control |
| | Edit `basePricePerSqm` | Denied | Allowed (Operational Staff) | Allowed (Operational Staff) | Field-level protection (`_product-access.ts`) |
| | Edit `inventorySqm` | Denied | Allowed (Maintenance Window) | Allowed (Maintenance Window) | Field-level & Server Guard (`CMS_STOCK_WRITE_MODE`) |
| | Delete Products | Denied | Denied | Allowed | Admin Portal Access Control |
| **Customer Accounts** | Self Profile Read / Update | Allowed (Self) | Allowed (All) | Allowed (All) | Ownership Check (`id == auth.id`) |
| | Create Customer | Denied | Allowed | Allowed | Support / Admin Workflow |
| | Assign `CustomerType` | Denied | Allowed | Allowed | Support / Admin Workflow |
| | Activate / Deactivate | Denied | Allowed | Allowed | Support / Admin Workflow |
| **Customer Types** | Read Tiers | Denied | Allowed (Read) | Allowed | Admin Portal Access Control |
| | Modify `markupPercent` | Denied | **Denied** | **Allowed** | Supervisor Restriction |
| **Orders** | Read Orders | Self Orders Only | Allowed (All) | Allowed (All) | Ownership Filter |
| | Submit Order | Allowed | Denied | Denied | Customer RPC Endpoint |
| | Self-Cancel (In Window) | Allowed | N/A | N/A | Deadline & Status Guard |
| | Advance Status | Denied | Allowed | Allowed | Staff Workflow Transition |
| | Force Cancel (Post-Window)| Denied | Allowed | Allowed | Staff Action + Stock Release |
| **Financing Plans** | View Plans | Allowed (Targeted) | Allowed | Allowed | Customer / Admin View |
| | Create / Edit Plans | Denied | Denied | Allowed | Supervisor Restriction |
| **CSV Batch Sync** | Upload & Preview Diff | Denied | Allowed | Allowed | Staff File Upload Gate |
| | Apply Price & Stock | Denied | Allowed | Allowed | Logged Staff Action |
| **Global Config** | Read Global Params | Public / Derived | Allowed | Allowed | System Service |
| | Edit Parameters | Denied | **Denied** | **Allowed** | Supervisor Restriction |
| **Audit Trails** | Read Audit Logs | Denied | **Denied** | **Allowed** | Supervisor Access Only |
| | Mutate / Delete Logs | Denied | **Denied** | **Denied** | Append-Only Invariant |

---

## 3. Critical Security Boundaries

### 3.1 Commercial Confidentiality Protection
Under no circumstances may a `Customer` discover:
- The wholesale base price (`basePricePerSqm`).
- The markup percentage (`markupPercent`) applied by their tier.
- The pricing, discounts, or order volumes of any competing business account.

Any API response exposing `basePricePerSqm` or raw tier calculation coefficients to an external customer token constitutes a critical security vulnerability.

### 3.2 Authorization at Data Boundary
- **Never Rely on Client-Side UI Hiding**: Disabling a button or omitting a navigation link in the frontend is purely a UX affordance. All permissions are verified server-side at the database query and procedure handler layer.
- **Strict Ownership Filtering**: On any order or customer lookup, the query unconditionally injects `where: { customer: context.user.id }` unless the authenticated actor possesses the `Support` or `Admin` role.

---

## 4. Immutable Audit Trail Specification

To ensure operational accountability, every high-impact internal action generates an uneditable `AuditEvent`.

### 4.1 Mandatory Audited Actions
The system automatically logs:
1. **CSV Sync Apply**: Actor ID, timestamp, filename, total affected rows, and count of price/stock modifications.
2. **Pricing Policy Changes**: Updates to `markupPercent` on any `CustomerType` (captures old value vs. new value).
3. **Customer Tier Reassignment**: Moving a customer between tiers (e.g., from Wholesale Partner to Exclusive Agent).
4. **Staff Order Actions**: Status transitions, force cancellations, or notes added by staff.
5. **Customer Status Changes**: Activating or deactivating a customer account.
6. **Global Parameter Updates**: Adjustments to price rounding policies, cancellation window durations, or ordering locks.

### 4.2 Audit Data Schema
```typescript
interface AuditEventRecord {
  id: string
  timestamp: string // ISO-8601 UTC
  actorType: 'customer' | 'support' | 'admin' | 'system'
  actorId: string // Unique ID of the acting entity
  action: string // Standard action identifier (e.g., "customer_type.markup_updated")
  entityType: 'product' | 'customer' | 'customer_type' | 'order' | 'import_run' | 'global_config'
  entityId: string // Identifier of the affected record
  metadata: {
    ipAddress?: string
    userAgent?: string
    previousValue?: Record<string, unknown>
    newValue?: Record<string, unknown>
    summary?: string
  }
}
```

### 4.3 Zero-Leakage Audit Invariant
**Strict Prohibition**: An audit record or system diagnostic log MUST NEVER contain:
- Cleartext or hashed passwords.
- Active SMS OTP verification codes.
- JWT bearer tokens or session secrets.
- Full unmasked customer credit or financial account numbers.
