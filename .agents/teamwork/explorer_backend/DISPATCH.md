## 2026-11-10T13:16:45Z

[Message] timestamp=2026-11-10T13:16:45Z sender=d9727e7d-d864-4b61-a8fc-1a1433c1459a priority=MESSAGE_PRIORITY_HIGH
You are the Backend & High-Concurrency Explorer for PersianPart 2.0.

Your working directory is: /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_backend
MANDATORY: First read /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/ORIGINAL_REQUEST.md completely.
Also review the project constitution in /Users/mm25zamanian/Codes/persianpartshop.ir/AGENTS.md.

GUARDRAILS & BOUNDARIES:
- Read-only exploration. You MUST NOT modify, delete, or create any source code, configuration, or test files in the repository.
- Only write metadata, reports, and handoff files in your working directory (/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_backend).
- Ground all observations in concrete file paths, function names, and code lines.

MISSION & TECHNICAL FOCUS:
Examine apps/api (Hono + oRPC on Bun, pg, Payload SDK) and apps/cms (Payload CMS v3 on Next.js + PostgreSQL) specifically with the assumption of several thousand active concurrent users (e-commerce peak load):
1. Database Architecture & Concurrency:
   - Database connection management (pg Pool config, max connections, connection lifecycle, idle timeouts).
   - Transaction management, isolation levels, and lock contention (cart operations, order creation, inventory decrements).
   - Query efficiency, indexing, presence of N+1 query patterns or unindexed filters.
2. Caching & State Management:
   - In-memory state vs distributed cache (Redis/KeyDB): does caching exist? What happens during traffic spikes?
   - Cache invalidation and stampede/thundering herd risks.
3. Bun Runtime & Async Execution:
   - Event loop blocking risks (heavy CPU operations, synchronous JSON parsing/serialization, crypto/hashing).
   - Threading and scaling model of Bun in production.
4. Asynchronous Processing & External Integrations:
   - How are external APIs called (Kavenegar SMS, payment gateways, external ERP/warehouse sync)?
   - Are calls synchronous or handled by a durable job queue (BullMQ, Kafka, etc.)? What happens if SMS/payment is slow or fails?
5. Resiliency, Rate Limiting & Failover:
   - Global rate limiting, request timeouts, circuit breakers, graceful shutdown, health checks.
6. Technical Debt & Architectural Trade-offs:
   - Document all discovered technical debts and design trade-offs in backend code.
   - For each item, record: Title, Severity (High/Medium/Low), Concrete file path & lines, Operational Impact under high concurrency, and Recommended Remediation.

DELIVERABLES:
1. Maintain your progress in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_backend/progress.md.
2. Write your comprehensive analysis in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_backend/analysis.md.
3. Write your final handoff in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_backend/handoff.md.
4. When finished, send a message to orchestrator with a summary of findings.
