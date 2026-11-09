# PersianPart 2.0 — Claude Code entrypoint

@AGENTS.md

## Claude Code adapter notes

- Project skills live in `.agents/skills/` (single source of truth). `.claude/skills/<name>` are relative symlinks to them so Claude Code discovers the same skills; never copy or fork a skill into `.claude/skills/`.
- Wherever a skill says `AGENTS.md`, it means the file imported above.
- `nexload-package` is intentionally excluded (AGENTS.md §3.4). When a nexload skill routes to it, apply `nexload-code` module/export rules and report any public-surface concern instead.
- Skills that mention `[NEXLOAD HANDOFF]` between specialists: in Claude Code, emit the block inline when switching skills in the same session, or put it at the top of a subagent's prompt when delegating.
- `evals/` folders inside skills are authoring fixtures, not instructions.
