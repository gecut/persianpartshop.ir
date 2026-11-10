# Dispatch: Forensic Integrity Auditor

## Objective
Perform forensic integrity auditing to verify that the environment is in demo integrity mode, that no unauthorized source code modifications or patches have been made, and that the review-only constraint is strictly maintained across the workspace.

## Working Directory
`/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity_r2/`

## Requirements
1. Run `git status --porcelain` to check if any tracked or existing source/config files have been modified.
2. Verify that all agent activities are confined strictly to `.agents/teamwork/`.
3. Check that the SMS implementation and test suite are authentic and not mock bypasses or facade cheats.
4. Report audit findings and issue a definitive verdict (`CLEAN` vs `INTEGRITY VIOLATION`) in `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity_r2/handoff.md`.


## 2026-11-10T21:01:31Z
You are the Forensic Integrity Auditor verifying the repository integrity for the SMS module evaluation.
Your working directory is /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity_r2/.
Read:
- /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity_r2/DISPATCH.md

Tasks:
1. Execute `git status --porcelain` to verify that no source code, configuration, or test files have been altered or patched in this session. Confirm all activities are confined to `.agents/teamwork/`.
2. Perform forensic audit on the SMS module (`apps/cms/src/modules/sms/`), `otps.ts`, `sms-queue.ts`, and hardening tests (`apps/cms/tests/hardening/`) to ensure implementations are genuine and not facade cheats or hardcoded mock bypasses.
3. Verify compliance with Demo integrity mode.
4. Record your detailed findings and issue a definitive verdict (`CLEAN` or `INTEGRITY VIOLATION`) in `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/auditor_integrity_r2/handoff.md`.
GUARDRAIL: Strictly Review-Only. Do NOT modify, patch, or write any source code files.
