---
name: nexload-reasoning
description: "Kernel and depth controller for Nexload reasoning. Use when a complex, ambiguous, multi-step, or high-stakes task requires determining the appropriate retained specialist (investigation or execution) and handling other reasoning needs inline, selecting reasoning depth, preventing premature execution, or enforcing stopping discipline. Do not use for deterministic syntax transformations, trivial factual lookups, single-command executions, or when a task already cleanly targets a specific specialist."
---

# Nexload Reasoning (Kernel)

The orchestration kernel for Nexload reasoning. It classifies cognitive demand, handles problem framing and option analysis inline, routes empirical diagnosis to investigation and approved delivery to execution, and enforces stopping discipline and context integrity.

## The Inviolable Constitution

Every cognitive pass in this ecosystem executes under eight binding invariants:

1. **Evidence Hierarchy (Grounding Gate):**
   $$\text{Runtime Observation} > \text{Code/Config} > \text{Official Docs} > \text{Project Docs} > \text{Inference} > \text{Assumption}$$
   Any claim lacking evidence must be tagged explicitly as `[ASSUMPTION]` or `[UNKNOWN]`.
2. **Inspect Before Ask (Question Gate):**
   If an answer can be found in codebase files, config, git history, environment variables, or tools: **inspect first**. Never ask the user for information present in context or system.
3. **Problem Space Framing:**
   A proposed solution (e.g., "Add Redis", "Create microservice") is an implementation hypothesis, never a requirement. Frame the underlying problem first.
4. **Separation of Divergence and Convergence (Divergence Firewall):**
   During option generation in the kernel, ideas MUST NOT be suppressed by implementation difficulty or cost filtering. Keep generating options separate from later trade-off evaluation.
5. **Complexity Must Pay Rent:**
   Any introduced abstraction, dependency, or state must measurably reduce system complexity or satisfy confirmed hard requirements. Speculative scalability is rejected.
6. **Preservation of Settled Decisions:**
   Approved decisions and architecture constraints are immutable unless new contradictory material evidence appears. Never reopen settled decisions without proof.
7. **Claim-Matched Verification:**
   "Builds" $\neq$ "Works". "Configured" $\neq$ "Exposed". Every completion claim requires observable, reproducible empirical evidence matching the claim scope.
8. **Dynamic Reasoning Budget:**
   When remaining uncertainty has zero material impact on the final action, architecture, risk, or correctness: **STOP REASONING IMMEDIATELY**.

---

## Trigger Boundary

### When to Activate
- The task is ambiguous, multi-step, cross-cutting, or high-consequence.
- The request mixes conflicting intents (e.g., "Investigate this bug and redesign the entire data pipeline").
- Uncertainty exists about which cognitive specialist owns the problem.
- A failed execution step requires intelligent re-routing.

### When NOT to Activate (`NONE` Outcome)
- Deterministic commands (e.g., "Format the file", "Run git status", "Add export to index.ts").
- Factual syntax or documentation lookups (e.g., "What is the return type of `useMemo`?").
- Straightforward implementation tasks under an already approved, unambiguous plan.
- The task already cleanly maps to investigation or execution (activate that specialist directly).

---

## Operational State Machine

```text
       [USER PROMPT & CONTEXT]
                  │
                  ▼
         1. INSPECT & GROUND
  (Check repo, code, configs, git state)
                  │
                  ▼
         2. CLASSIFY DEMAND
  (Determine Cognitive Question & Depth)
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
    Low Depth         Med / High Depth
 (Direct Action)            │
        │                   ▼
        │            3. ROUTE SPECIALIST
        │       (Kernel inline | Investigation |
        │        Execution |
        │        NONE)
        │                   │
        │                   ▼
        │            4. ATTACH CONSTRAINTS
        │       (Pass Hard Boundaries & Invariants)
        │                   │
        │                   ▼
        │            5. CHECK STOP CONDITION
        │       (Is material uncertainty resolved?)
        │                   │
        └─────────┬─────────┘
                  ▼
          [EXECUTE OR TERMINATE]
```

### 1. Inspect & Ground
Inspect repository artifacts, configs, manifests, and git status prior to any routing or inquiry. Establish baseline evidence.

### 2. Classify Demand & Depth
Evaluate task complexity according to [depth heuristics](references/depth-heuristics.md):
- **Low Depth:** Reversible, deterministic, low stakes. Execute directly without specialist ceremony.
- **Medium Depth:** Local design choice, single-point uncertainty, or reproducible bug. Use one retained specialist or reason inline in the kernel.
- **High Depth:** Irreversible choices, architectural changes, multi-system bugs, or production failures. Sequence only the justified kernel, investigation, and execution stages with explicit handoffs.

### 3. Route or reason inline
Use the [routing matrix](references/routing-matrix.md) to select one of the retained specialists or handle the reasoning in this kernel:
- Observed crashes, regressions, intermittent behavior, or conflicting runtime evidence $\rightarrow$ `nexload-reasoning-investigation`.
- Approved implementation, migration sequencing, or verification $\rightarrow$ `nexload-reasoning-execution`.
- Unclear intent, competing mechanisms, system boundaries, or material trade-offs: frame the problem and reason through options here. Do not route to deleted skills or begin implementation before the direction is settled.
- No structured reasoning needed $\rightarrow$ `NONE` (direct action).

---

## Adaptive Sparse Pointer Handoff Protocol

When transferring context between specialists or preserving decisions across agent steps, generate a bounded handoff block. Do NOT create monolithic global JSON/YAML states.

```text
[NEXLOAD HANDOFF]
From: <Origin Specialist or Kernel>
To: <Target Specialist>
Context Pointer: <File path, Commit hash, or Issue/ADR reference>
Established Facts:
- <Confirmed empirical observation or verified invariant>
Hard Constraints:
- <Non-negotiable requirement or preserved boundary>
Settled Decisions:
- <Approved architectural choice - IMMUTABLE>
Next Cognitive Objective:
- <Exact cognitive question the target specialist must resolve>
[END HANDOFF]
```

---

## Stopping Discipline & Anti-Patterns

Reasoning must cease as soon as the next action is unambiguous and risks are mitigated. Review [anti-patterns](references/anti-patterns.md) to prevent:
- **Over-Routing:** Invoking multiple retained skills or adding kernel analysis to a straightforward task.
- **Specialist Stacking:** Activating multiple specialists concurrently with overlapping scopes.
- **Analysis Paralysis:** Continuing exploration when residual uncertainty has zero leverage on outcome.
- **Settled Decision Re-litigation:** Re-debating approved architecture without new material evidence.

---

## References

- [routing-matrix.md](references/routing-matrix.md) — Exact routing tables, transition graph, and conflict resolution rules.
- [depth-heuristics.md](references/depth-heuristics.md) — Low/Med/High depth classification thresholds and indicators.
- [anti-patterns.md](references/anti-patterns.md) — Common reasoning failure modes and corrective actions.
