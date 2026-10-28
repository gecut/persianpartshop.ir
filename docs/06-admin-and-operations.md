# 06 — Administration, Catalog Operations & Runbook

This document defines standard operating procedures (SOPs) for internal operations staff (`Support`) and supervisors (`Admin`) managing PersianPart 2.0.

---

## 1. Trade Customer Onboarding & Management

Because PersianPart 2.0 does not offer open public registration, trade customer accounts are provisioned and qualified by internal staff.

### 1.1 Customer Creation Procedure
1. Navigate to **کاربران و مشتریان (Users / Customers)** in the administration portal.
2. Click **ایجاد کاربر جدید (Create User)**.
3. Complete mandatory identification fields:
   - **شماره موبایل (Mobile)**: Primary 11-digit Iranian mobile number (e.g., `09123456789`). Must be unique.
   - **نام فروشگاه / شرکت (Store / Company Name)**: Registered commercial title.
   - **نام رابط (Contact Name)**: Primary purchasing agent or owner.
   - **استان و شهر (Province & City)**: Geographical operational area.
   - **آدرس دقیق (Address)**: Default delivery unloading point.
4. Select the appropriate **نوع مشتری (CustomerType)**:
   - Sets the automated pricing markup tier for this customer.
5. Set **وضعیت کاربر (isActive)** to `true`.
6. Save the record. The customer can now authenticate immediately using SMS OTP.

### 1.2 Account Suspension
- Toggling `isActive` to `false` immediately revokes the customer's ability to request OTPs or submit new orders. Active in-flight orders are not cancelled automatically.

---

## 2. Catalog Enrichment & Product Completeness

Products represent individual physical tile/ceramic SKUs. Staff is responsible for enriching product records with visual media and technical specifications.

### 2.1 Product Creation Checklist
When registering a new tile product:
- [ ] **کد کالا (SKU)**: Input unique alphanumeric identifier (e.g., `PP-SLAB-120240-05`). Must be unique.
- [ ] **نام کالا (Name)**: Standard Persian trade name.
- [ ] **اسلاگ (Slug)**: URL-friendly Latin or Persian identifier.
- [ ] **دسته‌بندی (Category)**: Assign to primary category (e.g., پرسلان کف, اسلب پرسلان).
- [ ] **ابعاد (Dimension)**: Select from standardized dimensions (e.g., `60x120`).
- [ ] **ضریب متراژ هر کارتن (sqmPerCarton)**: **CRITICAL VALUE**. Must match physical factory carton specifications (e.g., `1.44`, `2.16`, `1.92`).
- [ ] **درجه کیفی (Grade)**: Select `grade_1`, `grade_2`, `grade_3`, or `grade_4`.
- [ ] **تصویر شاخص (Cover Image)**: Upload high-resolution front-facing slab photograph.
- [ ] **گالری تصاویر (Gallery)**: Add installation, ambient room setting, and surface texture photos.
- [ ] **ویژگی‌ها (Tags)**: Attach relevant tags (کالیبره, ضد اسید, نانو پولیش).

### 2.2 Product Completeness Audit
To maintain catalog quality, the system flags incomplete catalog records:
- **Critical Incompleteness** (Blocks customer ordering): Missing `sku`, missing `name`, missing `sqmPerCarton`, or missing `dimension`.
- **Quality Incompleteness** (Allowed but flagged): Missing `cover` photo, missing `category`, or missing `grade`.

---

## 3. CSV Price & Inventory Batch Synchronization

Wholesale base prices and physical inventory counts are updated in batch via the official Payload import-export plugin (`@payloadcms/plugin-import-export`), configured in update-only mode matching by `sku`.

```
CSV Input File (UTF-8, Max 100 rows)
├── Column: sku (Unique matching identifier)
├── Column: basePricePerSqm (Whole Tomans per m²)
└── Column: inventorySqm (Available physical net area in m², max 2 decimals)
```

### 3.1 Step-by-Step Sync Workflow

1. **File Preparation**:
   - Ensure the CSV is encoded in standard **UTF-8 without BOM**.
   - Ensure header names match exactly: `sku`, `basePricePerSqm`, `inventorySqm`.
   - Ensure numbers do not contain commas or currency symbols, and max file length is $\le 100$ rows.
2. **Execution**:
   - Navigate to **کاتالوگ و انبارداری > درون‌ریزی‌ها (Imports)**.
   - Upload file and trigger import. The import runs live; no maintenance window is required.
   - Existing SKUs are overwritten with the incoming `inventorySqm` and an auto-calculated `stockCartons`.
   - A batch containing any unknown SKU is rejected as a whole, so no partial products are created.
3. **Review**:
   - Review the import summary (`updated` count and issue details).
   - The announced `inventorySqm` is the authoritative balance; items sold outside the site are reflected in the next announcement.

---

## 4. Order Operations & Fulfillment

Customer orders flow into the administration portal with the initial status `pending_review`.

### 4.1 Order Review & Progression Checklist

```mermaid
graph LR
    A[pending_review] -->|1. Confirm Credit & Stock| B[confirmed]
    B -->|2. Warehouse Picking Sheet| C[preparing]
    C -->|3. Pallets Loaded on Transport| D[ready]
    D -->|4. Customer Delivery Acknowledged| E[completed]
```

1. **Review (`pending_review` $\rightarrow$ `confirmed`)**:
   - Verify customer's trade credit or payment arrangement.
   - Confirm that the physical warehouse has not suffered breakages affecting the required cartons.
   - Advance status to `confirmed`. (Customer can no longer cancel directly).

2. **Warehouse Dispatch (`confirmed` $\rightarrow$ `preparing`)**:
   - Print packing slip showing:
     - SKU & Product Name
     - Total Cartons to pick ($\text{cartonCount}$)
     - Equivalent Area in $m^2$ ($\text{actualSqm}$)
   - Warehouse staff picks and palletizes the requested cartons.

3. **Transport Ready (`preparing` $\rightarrow$ `ready`)**:
   - Pallets are staged at loading dock. Customer or carrier is notified.

4. **Order Completion (`ready` $\rightarrow$ `completed`)**:
   - Bill of lading is signed upon customer receipt.
   - Mark order as `completed`. This is a permanent terminal state.

---

## 5. Exception Handling & Manual Staff Cancellation

### 5.1 When Can Staff Cancel an Order?
Staff may cancel an order when:
- The customer requests cancellation after their direct grace window has elapsed.
- A physical warehouse discrepancy (damage, tile batch breakage) prevents fulfillment.
- Commercial credit terms cannot be verified.

### 5.2 Stock Release Invariant
When staff executes a cancellation on an active order (`pending_review`, `confirmed`, `preparing`, or `ready`):
1. The status changes to `cancelled`.
2. A required staff cancellation reason is entered into the order timeline.
3. **Automated Stock Release**: The system automatically restores the exact carton quantities ($\text{actualSqm}$) to physical inventory:
   $$\text{inventorySqm} = \text{inventorySqm} + \sum \text{item.actualSqm}$$
4. Once cancelled, an order can never be reopened or re-confirmed.

---

## 6. Configuring Promotional Credit & Financing Plans (`Plans`)

Wholesale buyers rely on flexible trade credit and seasonal installment terms.

### 6.1 Creating a Promotional Financing Card
1. Navigate to **طرح‌های اعتباری و اقساطی (Plans)**.
2. Click **ایجاد طرح جدید (New Plan)**.
3. Configure the informational fields:
   - **عنوان طرح (Title)**: E.g., "طرح تابستانه پرداخت اعتباری ۶۰ روزه همکاران".
   - **درصد پیش‌پرداخت (Prepayment Percent)**: E.g., $25\%$.
   - **مدت اقساط (Tenor Months)**: E.g., 2 months.
   - **مشتریان هدف (Target Customer Types)**: Choose which customer tiers can view this plan (or leave empty for all trade buyers).
   - **توضیحات و شرایط ضمانت (Terms & Conditions)**: Document required promissory notes, bank check clearance rules, and maximum invoice limits.
4. Set `isActive` to `true`.
5. The plan immediately renders as an informational card in the customer's mobile portal.
