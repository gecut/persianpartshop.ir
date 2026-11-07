# Dynamic Reasoning Depth Heuristics

This reference establishes the operational heuristics used by `nexload-reasoning` to determine the depth of reasoning required for a given prompt or task.

---

## 1. Depth Classification Levels

```text
┌─────────────────────────────────────────────────────────────┐
│                       REASONING DEPTH                       │
├─────────────────┬───────────────────────┬───────────────────┤
│    LOW DEPTH    │     MEDIUM DEPTH      │    HIGH DEPTH     │
│  (Direct action)│ (Kernel or 1 skill)   │ (Staged reasoning)│
├─────────────────┼───────────────────────┼───────────────────┤
│ • Deterministic │ • Local architecture  │ • Cross-cutting   │
│ • Fully local   │ • Non-trivial bug     │ • Irreversible    │
│ • Instant proof │ • 2-3 design options  │ • High blast zone │
│ • Safe fallback │ • Unclear edge cases  │ • Hard trade-offs │
└─────────────────┴───────────────────────┴───────────────────┘
```

---

## 2. Classification Criteria

### Level 1: Low Depth (`NONE`)
- **Characteristics:**
  - Zero material architectural ambiguity.
  - Reversible in seconds (e.g. single git checkout).
  - Scope is strictly bounded within a single file or function.
  - Verification is deterministic (compiler, linter, formatting check).
- **Examples:**
  - "Rename `getUserData` to `fetchUserProfile` across `src/user.ts`."
  - "Add a missing type export to `src/index.ts`."
  - "What does HTTP status 429 mean?"
- **Operational Action:** Bypass specialist activation. Execute directly.

### Level 2: Medium Depth (Kernel or One Specialist)
- **Characteristics:**
  - One dimension of material uncertainty (e.g., intent ambiguity, unknown bug cause, or a choice between viable mechanisms).
  - Blast radius is contained within a module or package.
  - Verification requires a targeted integration check or reproduction.
- **Examples:**
  - "Why does this request intermittently return 500?" $\rightarrow$ `nexload-reasoning-investigation`.
  - "Make this export faster" with unclear success criteria $\rightarrow$ frame the goal inline in `nexload-reasoning`.
  - "Should we use one of these two libraries?" $\rightarrow$ compare evidence and constraints inline in `nexload-reasoning`.
- **Operational Action:** Use exactly one retained specialist when its trigger fits; otherwise the kernel handles the bounded framing or trade-off. Escalate only if evidence reveals material cross-cutting complexity.

### Level 3: High Depth (Staged Reasoning)
- **Characteristics:**
  - Multiple dimensions of uncertainty or a cross-cutting change with material operational risk.
  - One-way-door decisions (data migrations, public API deprecations, new external dependencies).
  - Runtime anomaly with incomplete telemetry and downstream architectural implications.
- **Examples:**
  - "Replace the auth system while preserving SMS fallback" $\rightarrow$ frame constraints and assess the design inline, then use execution after approval.
  - "Production database OOMs every Tuesday at 03:00 UTC" $\rightarrow$ investigation, kernel reassessment if the evidence changes the system direction, then execution after approval.
- **Operational Action:** Sequence only the reasoning stages justified by evidence. Use sparse handoffs between kernel, investigation, and execution; do not invoke deleted skills or impose a fixed specialist chain.

---

## 3. Dynamic Budget Throttling (Stopping Heuristics)

Reasoning must immediately stop when any of the following conditions is met:

1. **Uncertainty is Immaterial:** Remaining unknown details have no impact on the choice of architecture, libraries, interfaces, or verification strategy.
2. **Reversible Default Exists:** A sensible default exists that is trivial to change later without migrating data or breaking consumers.
3. **Evidence Cap Reached:** Further speculative analysis cannot yield new information without running an empirical experiment or code execution.
4. **Dominance Established:** One option strictly dominates all alternatives on critical dimensions (performance, simplicity, operational burden) with zero fatal weaknesses.
