# 03 — Core System Flows & Lifecycle State Machines

This document specifies the end-to-end procedural workflows and deterministic state transitions governing PersianPart 2.0.

---

## 1. Authentication & Session Flow (SMS OTP)

PersianPart 2.0 enforces a passwordless, phone-based authentication model for trade customers.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Trade Customer
    participant Web as Web Client (SPA)
    participant API as API Server (Hono / Bun)
    participant SMS as SMS Gateway (Kavenegar)
    participant CMS as CMS / Database

    Customer->>Web: Enters mobile number (e.g., 0912xxxxxxx)
    Web->>API: POST /api/rpc/auth.requestOtp { mobile }
    API->>CMS: Check if Customer exists & isActive == true
    alt Customer Not Found or Inactive
        API-->>Web: Error (Account inactive or unauthorized)
    else Active Customer
        API->>API: Generate 5-digit cryptographically secure OTP & Store with TTL (120s)
        API->>SMS: Send OTP SMS via verified lookup template
        SMS-->>Customer: Deliver SMS containing code
        API-->>Web: Success (OTP Sent, retry allowed in 120s)
    end

    Customer->>Web: Enters 5-digit OTP
    Web->>API: POST /api/rpc/auth.verifyOtp { mobile, code }
    API->>API: Validate code & expiration
    alt Code Invalid or Expired
        API-->>Web: Error (Invalid or expired verification code)
    else Code Valid
        API->>API: Invalidate / consume OTP immediately
        API->>API: Issue signed JWT session token (HS256)
        API-->>Web: Return JWT token & Customer Profile
        Web->>Web: Persist token & Redirect to Product Catalog
    end
```

### Authentication Rules
- **Rate Limiting**: An individual phone number cannot request more than 1 OTP per 2 minutes, and is blocked for 15 minutes after 5 consecutive incorrect verify attempts.
- **Single-Use Consumption**: Once verified, the OTP is instantly purged from active memory/cache to prevent replay attacks.
- **Never Log Secrets**: The cleartext OTP value is NEVER logged to technical logs or audit trails.

---

## 2. Product Discovery & Order Entry Flow

```mermaid
flowchart TD
    Start([Customer on Catalog]) --> Filter[Apply Filters: Dimensions, Brand, Grade, Category]
    Filter --> List[Render Compact B2B Product Row]
    List --> Select[Tap Product Row]
    Select --> Modal[Open Order Entry Modal]
    Modal --> Input[Input Desired Area in m²]
    Input --> Calc[Client Engine Previews:<br/>Carton Count = ceil requested / sqmPerCarton<br/>Actual Area = Cartons * sqmPerCarton<br/>Total Price = Actual Area * Customer Unit Price]
    Calc --> CheckStock{Actual Area <= Available Stock?}
    CheckStock -- No --> ErrorBadge[Show Warning: Exceeds Warehouse Stock]
    CheckStock -- Yes --> AddBtn[Enable 'Add to Cart' Button]
    AddBtn --> AddCart[Add to Live Cart & Show Toast]
```

---

## 3. Order Lifecycle State Machine

The order lifecycle is governed by a deterministic, finite state machine with strict transition guards:

```mermaid
stateDiagram-v2
    [*] --> pending_review : Customer Submits Order

    pending_review --> confirmed : Staff Reviews & Confirms
    pending_review --> cancelled : Customer Cancels (within deadline)
    pending_review --> cancelled : Staff Cancels

    confirmed --> preparing : Warehouse Picking & Loading
    confirmed --> cancelled : Staff Cancels with reason

    preparing --> ready : Palletized & Ready for Dispatch
    preparing --> cancelled : Staff Cancels with inventory release

    ready --> completed : Dispatched & Received by Customer

    completed --> [*] : Terminal State
    cancelled --> [*] : Terminal State (Stock Restored)
```

### 3.1 Allowed Statuses & State Definitions

| Status Key | Persian Display Label | Definition & Operational Meaning |
| :--- | :--- | :--- |
| `pending_review` | در حال بررسی واحد بازرگانی | Newly submitted order awaiting commercial verification. Eligible for customer self-cancellation. |
| `confirmed` | تأیید شده توسط بازرگانی | Commercial team has verified inventory, pricing, and account standing. |
| `preparing` | در حال بارگیری و انبارداری | Physical cartons are being picked, palletized, and prepared at the central warehouse. |
| `ready` | آماده تحویل / بارگیری | Goods are loaded on truck or ready for transport pickup. |
| `completed` | تکمیل و تحویل شده | Delivery confirmed and goods accepted by the trade customer. Terminal state. |
| `cancelled` | لغو شده | Order voided; reserved inventory restored to warehouse. Terminal state. |

### 3.2 Transition Invariants
1. **Unidirectional Flow**: Statuses move forward strictly along the primary track. Backward transitions (e.g., `preparing` $\rightarrow$ `pending_review`) are prohibited.
2. **Terminal Inviolability**: `completed` and `cancelled` are permanent terminal states. No further status changes can occur on a completed or cancelled order.
3. **No Free-Form Edits**: Statuses cannot be edited arbitrarily; every transition must occur via authorized command endpoints that trigger stock checks and audit events.

---

## 4. Customer Self-Service Cancellation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Client as Web App
    participant Server as Order Service
    participant DB as Database Engine

    Customer->>Client: Clicks 'Cancel Order' on Recent Order
    Client->>Client: Check: now() <= order.cancellationDeadline?
    alt Deadline Expired
        Client-->>Customer: Cancellation Window Expired. Please contact Support.
    else Deadline Valid
        Customer->>Client: Confirms Cancellation Prompt
        Client->>Server: POST /api/rpc/order.cancelByCustomer { orderId }
        Server->>DB: Begin ACID Transaction
        Server->>DB: Query Order FOR UPDATE
        Server->>Server: Verify: status == 'pending_review' AND now() <= cancellationDeadline
        alt Verification Fails
            Server->>DB: Rollback
            Server-->>Client: Error (Cancellation Window Expired or Order Already Confirmed)
        else Verification Succeeds
            Server->>DB: Update order status = 'cancelled', cancelledBy = 'customer'
            loop For Each OrderItem
                Server->>DB: Restore stock: inventorySqm = inventorySqm + item.actualSqm
            end
            Server->>DB: Append Timeline Event (customer_cancelled)
            Server->>DB: Commit Transaction
            Server-->>Client: Success (Order Cancelled & Stock Released)
            Client->>Client: Refresh UI to show Cancelled Badge
        end
    end
```

---

## 5. Reorder Workflow

```mermaid
flowchart TD
    Start([Customer Views Order Detail]) --> ReorderBtn[Click 'Reorder Items' / سفارش مجدد]
    ReorderBtn --> Fetch[Server Loads Original Product IDs & Quantities]
    Fetch --> Query[Query Live Products, Current Prices & Live Inventory]
    Query --> Evaluate{Are all items active & in stock?}
    Evaluate -- No --> Warn[Add available items to Cart;<br/>Flag discontinued/out-of-stock items with clear banner]
    Evaluate -- Yes --> Populate[Populate Live Cart with Recalculated Quantities & Current Prices]
    Warn --> Cart[Redirect Customer to Live Cart]
    Populate --> Cart
    Cart --> Review[Customer Reviews Cart & Proceeds to Normal Checkout]
```

**Key Principle**: Reorder is an accelerator for purchasing, **never an automatic re-submission**. The customer must always review and execute standard checkout.

---

## 6. CSV Operational Sync Pipeline

```mermaid
flowchart LR
    A[Staff Uploads CSV] --> B[Structural & Header Validation]
    B --> C[Row Parse & Format Verification]
    C --> D[SKU Match Against Database]
    D --> E[Diff Engine:<br/>Compute Price & Stock Delta]
    E --> F[Suspicious Change Detector]
    F --> G[Interactive Preview Report]
    G --> H{Staff Approves Apply?}
    H -- No / Reject --> I[Abort & Log Cancellation]
    H -- Yes / Confirm --> J[Atomic Database Update]
    J --> K[Record ImportRun Audit Event]
```

### Pipeline Phases (Official Plugin Update-Only Pipeline)
1. **Upload & Parse**: Reads CSV data via official `@payloadcms/plugin-import-export` (update-only mode, matching by `sku`); validates UTF-8 encoding and required columns (`sku`, `basePricePerSqm`, `inventorySqm`).
2. **Pre-flight & Row Validation**: Verifies that prices and stock values are valid non-negative numbers and that the file contains $\le 100$ rows. Duplicate SKUs inside the CSV halt the file before writing.
3. **SKU Matching & Execution**:
   - Matched SKUs update base price and net inventory in maintenance window mode.
   - Unmatched SKUs (in CSV but not in DB) produce native row-level issue reports and do not create new products.
   - Per-row errors do not halt valid sibling rows; native summary reports `updated` and `issues`.
4. **Maintenance Drain & Apply**: The import operates in a controlled server maintenance window (`CMS_STOCK_WRITE_MODE=import`) preventing concurrent order reservation race conditions. Derived carton counts (`stockCartons`) are recalculated synchronously on the server.
