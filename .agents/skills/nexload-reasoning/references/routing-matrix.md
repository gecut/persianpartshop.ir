# Routing Matrix & Transition Graph

This reference governs how the `nexload-reasoning` kernel selects a retained specialist or performs bounded reasoning inline. Only `nexload-reasoning-investigation` and `nexload-reasoning-execution` are separate reasoning specialists in this repository.

---

## 1. Primary Routing Table

| Need or symptom | Primary question | Action |
|---|---|---|
| Crashes, inconsistent behavior, performance anomaly, or conflicting runtime evidence | What is happening, what caused it, and which observation distinguishes the hypotheses? | `nexload-reasoning-investigation` |
| Approved direction ready to implement, migrate, or verify | What is the safest sequence, and what evidence proves the result? | `nexload-reasoning-execution` |
| Ambiguous intent or a proposed solution presented as a requirement | What outcome is needed, under which constraints, and what must remain unchanged? | Frame inline in the kernel; inspect first, then ask only for missing human-owned decisions |
| Several plausible mechanisms or architectures | Which materially different options satisfy the confirmed objective? | Generate and compare options inline in the kernel; do not filter during ideation |
| A selected direction needs boundaries, ownership, interfaces, or failure behavior | What is the smallest coherent design that satisfies the constraints? | Resolve inline in the kernel before execution |
| Material trade-offs, library choice, risk, or reversibility | Which option best meets the confirmed constraints, and what evidence could invalidate it? | Evaluate inline in the kernel; retrieve current evidence when version-sensitive |
| Deterministic refactor, syntax change, factual lookup, or approved plan step | Can this be done directly with immediate, reproducible verification? | `NONE` (direct action) |

Do not refer to or attempt to load removed specialist skills. The reasoning responsibilities they covered remain kernel work; they are not additional skills or mandatory phases.

---

## 2. Non-Linear Transitions

The workflow is evidence-driven, not a fixed pipeline:

```text
Kernel / inline framing, ideation, design, or evaluation
  ├─ verified anomaly or unknown cause ──> Investigation
  ├─ approved direction ready to deliver ─> Execution
  └─ bounded, deterministic task ─────────> Direct action (NONE)

Investigation
  ├─ local causal fix is clear ───────────> Execution
  ├─ approved boundary/design must change > Kernel (reframe, design, evaluate)
  └─ evidence remains insufficient ───────> Investigation continues

Execution
  ├─ local code or sequencing defect ─────> Execution continues
  ├─ evidence invalidates an assumption ─> Investigation or kernel reassessment
  └─ material intent/design decision ────> Kernel reassessment before more changes
```

Use sparse handoffs when the next stage needs preserved evidence, constraints, or settled decisions. A handoff does not imply a separate agent or automatically reopen a decision.

---

## 3. Conflict Resolution

### Intent uncertainty vs. runtime uncertainty

- Use investigation when an observable runtime or data deviation has an unknown cause.
- Keep goal, scope, and stakeholder ambiguity in the kernel. Inspect accessible project evidence first; ask the user only for decisions that cannot be recovered locally.

### Option generation vs. system design

- During option generation, identify materially distinct mechanisms without prematurely ranking them by implementation convenience.
- Once the objective and candidates are clear, design the selected direction inline: state ownership, boundaries, data flow, errors, and contracts.

### Design vs. evaluation

- Design asks whether a candidate can form a coherent system.
- Evaluation compares viable candidates against confirmed constraints, cost, complexity, risk, and reversibility.
- Do not invent a library choice or re-open a settled decision without material contradictory evidence.

### Evaluation vs. execution

- Evaluation ends with a chosen direction and its material conditions.
- Execution starts only when the direction is approved or otherwise authorized; it sequences changes and verifies their effects.

---

## 4. `NONE` Rule

Route directly when the task is bounded and reversible, does not change an architectural boundary or business rule, and has deterministic verification. Do not add specialist overhead to trivial work.
