# Ecosystem Anti-Patterns & Corrective Interventions

This reference catalogs cognitive pathologies, reasoning smells, and architectural failure modes across the `nexload-reasoning` ecosystem, pairing each with its mandated constitutional correction.

---

## 1. Global & Kernel Anti-Patterns

### AP-01: Ritualized Over-Routing
- **Symptom:** Invoking every reasoning skill sequentially for a straightforward prompt, creating latency and overhead.
- **Root Cause:** Treating the reasoning workflow as a mandatory conveyor belt rather than an on-demand toolbox.
- **Correction:** Enforce the `NONE` outcome for trivial tasks and limit medium-depth tasks to exactly 1 specialist.

### AP-02: Specialist Stacking
- **Symptom:** Invoking multiple specialists in parallel or in rapid back-and-forth chatter without defined handoff artifacts.
- **Root Cause:** Lack of ownership clarity.
- **Correction:** Route to exactly one owner specialist at a time. Require an explicit `[NEXLOAD HANDOFF]` before any secondary specialist is activated.

### AP-03: Reopening Settled Decisions (Re-Litigation)
- **Symptom:** Later specialists (e.g., Execution or Design) continually debate or alter previously approved decisions (e.g., choice of library or data schema).
- **Root Cause:** Failure to respect Invariant #6 (Preservation of Settled Decisions).
- **Correction:** Settled decisions in handoff blocks are IMMUTABLE. Only new material evidence or a fatal blocker can justify revisiting a settled decision in the kernel.

---

## 2. Boundary-Specific Anti-Patterns

### AP-04: Solution-First Framing
- **Symptom:** Accepting a proposed solution (e.g., "Add Redis", "Split into microservices") as the user's requirement without identifying the underlying job to be done.
- **Correction:** Invariant #3. Transform the solution hypothesis into the root problem (latency, contention, caching, decoupling) before exploring mechanisms in the kernel.

### AP-05: Question Outsourcing
- **Symptom:** Asking the user for codebase details, configuration values, or reproduction logs that are readily available in local files or tools.
- **Correction:** Invariant #2 (Inspect Before Ask). Inspect codebase files, environment configs, and git history before posing any question to the user.

### AP-06: Symptom Patching (Investigation Failure)
- **Symptom:** Applying quick one-line try-catches or arbitrary delays without discovering the root cause or establishing a discriminator test.
- **Correction:** Invariant #1 & Investigation State Machine. Require at least two competing hypotheses and a discriminating observation before implementing a fix.

### AP-07: Premature Convergence & Feasibility Filtering
- **Symptom:** Discarding novel ideas during brainstorming because "that would take too long to build" or "our framework doesn't do that easily".
- **Correction:** Invariant #4 (Divergence Firewall). During option generation in the kernel, keep materially distinct mechanisms separate from later feasibility and trade-off analysis.

### AP-08: Speculative Scalability / Architecture Astronautics
- **Symptom:** Introducing complex event buses, plugin architectures, or dynamic multi-tenant registries for a system with 1 tenant and 5 requests per minute.
- **Correction:** Invariant #5 (Complexity Must Pay Rent). Design for current confirmed needs + the nearest credible extension. Reject premature abstraction.

### AP-09: Option Dumping & Balanced Paralysis
- **Symptom:** Presenting pros and cons for several options without eliminating dominated alternatives or making a decisive recommendation.
- **Correction:** Compare candidates against confirmed constraints, risk, and reversibility in the kernel. State a justified recommendation or the evidence still needed to choose.

### AP-10: Completion by Assertion (Execution Failure)
- **Symptom:** Announcing "The feature is implemented and works!" merely because the TypeScript compiler exited with code 0.
- **Correction:** Invariant #7 (Claim-Matched Verification). Verification evidence must match the claim: runtime execution, reproduction test passing, or network curl check.
