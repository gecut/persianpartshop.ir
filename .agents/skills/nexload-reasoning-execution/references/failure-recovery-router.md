# Failure Recovery Router: Diagnosing Failure Origins

This reference classifies execution blockers and identifies when to continue locally, investigate, or return to kernel-level reasoning.

---

## 1. Earliest Invalid Assumption

When an implementation step fails, do not patch the surface symptom. Identify the earliest invalid assumption and route only to the work that can resolve it:

| Failure origin | Action |
|---|---|
| Local code defect | Stay in execution; fix the defect and rerun the relevant check. |
| Plan sequence or missing prerequisite | Stay in execution; reorder phases and update prerequisites. |
| Runtime behavior or causal uncertainty | Hand off to `nexload-reasoning-investigation` with reproduction evidence. |
| Material design, option, or requirement invalidation | Return to `nexload-reasoning` for inline reassessment before more implementation. |

---

## 2. Failure Classification

### Tier 1: Local Code Defect (Stay in Execution)

- **Signals:** Typo, syntax error, missing import, off-by-one index, or local type mismatch.
- **Action:** Fix locally and rerun the narrowest decisive check. Do not escalate a routine defect.

### Tier 2: Plan Sequence Defect (Stay in Execution)

- **Signals:** A check fails because a prerequisite step did not run, or migration order is incorrect.
- **Action:** Reorder the phases, state the dependency, and continue verification.

### Tier 3: Causal or Runtime Uncertainty (Investigation)

- **Signals:** Crash, unexpected network behavior, intermittent failure, or unexplained production/runtime data.
- **Action:** Hand off to `nexload-reasoning-investigation` with exact observations, reproduction steps, and ruled-out hypotheses.

### Tier 4: Material Design, Option, or Intent Invalidation (Kernel)

- **Signals:** A boundary is incoherent, the selected option is incompatible with verified constraints, or implemented behavior violates the confirmed requirement.
- **Action:** Stop implementation. Return to `nexload-reasoning` with the contradictory evidence and the decision that must be revisited. The kernel handles framing, design, and trade-off analysis inline; it does not route to removed specialist skills.

---

## 3. Recovery Handoff

When a handoff is useful, include the exact command or reproduction, observed result, preserved constraints, and the next narrow question. Do not repeat investigation that already has evidence, silently alter a settled decision, or claim recovery before the original failure check passes.
