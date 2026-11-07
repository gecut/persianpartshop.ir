---
name: tailwind-css-v4
description: Use when styling or configuring Tailwind CSS v4 in PersianPart's Vite + React app, including CSS-first tokens, responsive utilities, RTL layout, and generated classes.
---

# Tailwind CSS v4 in PersianPart

## Authority

Inspect the installed Tailwind version, `apps/web/vite.config.ts`, `apps/web/src/styles/globals.css`, and nearby components before changing styles. Local tokens, HeroUI components, RTL conventions, and existing behavior take precedence over generic examples. For v4 directive or utility semantics, consult the matching official Tailwind documentation; do not guess from v3 patterns.

## Project setup

- `apps/web` uses `@tailwindcss/vite` through the Vite plugin. The stylesheet entry imports `tailwindcss` and `@heroui/styles` in that order.
- Theme tokens are defined with CSS `@theme` and semantic custom properties in `globals.css`. Reuse those tokens instead of introducing a palette or another theme layer.
- Use the installed `@heroui/react` components for their component responsibilities. Do not add `tailwind-variants`, `tailwind-merge`, `clsx`, or a second `cn()` helper; the existing helper is re-exported from HeroUI.
- Do not add a Tailwind config, PostCSS integration, Next.js setup, dark-mode provider, or plugin unless the task and repository configuration require it.

## Styling rules

- Keep class names statically discoverable by Tailwind. If class construction or source scanning changes, verify generated utilities with the real production build.
- Prefer existing semantic tokens and layout utilities. Use logical spacing and positioning utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) for RTL-safe layout; follow the `rtl-persian-ui` skill for Persian-facing screens.
- Preserve responsive, focus, disabled, loading, and reduced-motion behavior. Do not redesign outside the requested visual change.
- Keep exceptional CSS in the existing stylesheet or component CSS when a utility cannot express the behavior clearly; avoid duplicating global tokens in component styles.

## Workflow and verification

1. Identify the requested visual change and the affected states and viewports.
2. Reuse the existing tokens, component patterns, and utilities; make the smallest effective change.
3. Run `pnpm --filter @persianpart/web build` when source scanning, directives, tokens, or generated classes are affected. Run the narrowest relevant repository check for other changes.
4. Inspect the changed state at a representative viewport. Broaden to narrow/wide viewports and interactions when the changed rules affect them. Textual class review alone does not establish visual correctness.

Report the exact checks and viewports inspected. Do not claim rendered verification when no browser inspection was performed.
