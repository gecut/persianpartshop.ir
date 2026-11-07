---
name: heroui-v3
description: HeroUI v3 usage in apps/web (React 19 + Tailwind CSS v4). Use when adding, changing or reviewing any UI built with @heroui/react — compound components, semantic variants and tokens, onPress events, RTL-safe layout, and the heroui-react MCP as the API source of truth.
---

# HeroUI v3 in PersianPart

## Ground rule

`@heroui/react` v3 is not v2. Never write props from memory.

Fetch the API first, every time:

- MCP server `heroui-react`: `get_component_docs({ components: ["Button"] })`, `get_docs({ path })`, `list_components()`.
- Fallback when the MCP is unavailable: read the installed types in `apps/web/node_modules/@heroui/react`.

## Project wiring (already in place — do not duplicate)

- `apps/web/src/styles/globals.css` starts with `@import "tailwindcss";` then `@import "@heroui/styles";`. Import order matters; never reorder or add a second copy.
- No `Provider` wrapper. v3 requires none — do not reintroduce one.
- Requirements are React 19+ and Tailwind v4; both are installed.
- `globals.css` deliberately overrides `corner-shape` and slider internals. Change those selectors only with a visual reason and a before/after check.

## Composition over styling

Use compound parts instead of restyling a single root:

```tsx
<Card variant="default">
  <Card.Header>
    <Card.Title>...</Card.Title>
    <Card.Description>...</Card.Description>
  </Card.Header>
  <Card.Content>...</Card.Content>
  <Card.Footer>...</Card.Footer>
</Card>
```

`Drawer`, `Modal`, `Select`, `Dropdown`, `Tabs`, `Tooltip` follow the same pattern (`Drawer.Dialog`, `Modal.Content`, `Select.Trigger`, `Tabs.List`). Read the anatomy section of the component doc before nesting parts.

## Component-specific variants

Variant unions belong to each component; do not assume one shared set. For `Button`, the installed HeroUI types and v3 docs show `primary`, `secondary`, `tertiary`, `outline`, `ghost`, `danger`, and `danger-soft`, with `primary` as the default. `default` is not a valid `Button` variant. Confirm other components against their own docs and installed types.

- `Button` sizes are `sm`, `md`, and `lg`; states include `isPending`, `isIconOnly` (provide an accessible name), `isDisabled`, and `fullWidth`.
- Interactive components use `onPress`, not `onClick`, unless the specific component API says otherwise.
- Icons are children; decorative icons get `aria-hidden`.

Do not copy v2-era snippets (`color` prop, `startContent`/`endContent`, standalone `@heroui/button` packages) without confirming them in the component doc. Only `@heroui/react` and `@heroui/styles` are legitimate imports.

## Styling

- Use semantic tokens: `bg-surface`, `text-foreground`, `text-muted`, `border-border`, `bg-muted/10`, `text-warning`. Raw `gray-*`/`slate-*` pairs break theming.
- `className` is for layout only (gap, padding, width, safe-area). Visual intent belongs in `variant`.
- Escaped-important utilities (`h-auto!`, `m-0!`) in drawers and sheets are load-bearing. Do not remove them during a refactor.

## Localization

`I18nProvider` localizes built-in component strings; it is used in `src/features/products/product-config-card.tsx`. Wrap a localized subtree once, not once per component.

## Verify

- `pnpm --filter @persianpart/web exec tsc --noEmit`
- `pnpm --filter @persianpart/web build`
- Open one RTL screen: component docs are LTR-first and their examples do not prove RTL behavior.