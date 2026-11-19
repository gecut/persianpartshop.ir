# LLM-Only Standards & System Guidelines

This document serves as the direct LLM-only reference point for autonomous AI agents and automated pipelines in **PersianPart 2.0**.

The authoritative catalog product creation, naming formulas, and category partitioning standards are specified in:
👉 **[11 — استاندارد ساخت و نام‌گذاری محصولات (LLM-Only Standard)](11-product-creation-standards.md)**

### Key Invariants for LLMs at a Glance:
1. **Naming Formula:** `[Design] [Color] [Glaze]` strictly.
2. **Category Names in Titles:** FORBIDDEN. Never include "اسلب", "قرنیز", "کاشی", or "سرامیک" in product titles.
3. **Word 'پرسلان':** FORBIDDEN in general titles, WITH EXCLUSIVE SLAB EXCEPTION. Slabs with matte glaze MUST be named `مات پرسلان`, and punch slabs `مات پانچ پرسلان`. All other categories forbid 'پرسلان'.
4. **Letter 'W':** FORBIDDEN. Eliminate the letter `W` from all product titles.
5. **Slabs (Cat 3):** Strictly 120×280 cm only. Matte glaze MUST be `مات پرسلان`. Punch surface MUST be `مات پانچ پرسلان`. Grade 4 MUST be `grade_d`.
6. **Color Field Synchronization:** The `color` field on the product entity (`products.color`) MUST be populated and match the color extracted from the name.
7. **CMS MCP Connection & Operations:** Operational procedures, security boundaries, and upload/import mechanisms are detailed in **[06 — Admin and Operations](06-admin-and-operations.md)**. All MCP calls to `createProducts`, `updateProducts`, and `applyCsvImport` must strictly comply with document 11.
