---
name: frontend-design
description: "This skill should be used when creating distinctive, production-grade frontend interfaces with high design quality. This includes building web components, pages, dashboards, landing pages, React components, HTML/CSS layouts, styling, beautifying web UI, chat interfaces, or any task requiring polished frontend output. Trigger keywords: frontend, UI, design, component, landing page, dashboard, layout, styling, beautify, React component, web interface, tailwind, shadcn."
---

# Frontend Design

## Overview

Generate polished, production-grade frontend code that avoids generic AI aesthetics. Every component must look intentionally designed by a human, with cohesive spacing, color, motion, and typography.

## Decision Tree

1. **New page / full layout** → Start from the project's layout system. Use the three-column pattern (sidebar / main / panel) from `references/design-system.md`.
2. **New component** → Check if a shadcn/ui primitive exists first (`references/component-patterns.md`). Extend rather than rewrite.
3. **Restyling / beautifying** → Read the existing code, identify anti-patterns, apply the design tokens from `references/design-system.md`.

## Design Principles

- **Dark-first**: Optimize for dark mode. Light mode is secondary.
- **Layered surfaces**: Use `surface` → `surface-elevated` → `surface-muted` for depth hierarchy. Never use flat same-color backgrounds.
- **Purposeful motion**: Every animation must serve a function (feedback, orientation, continuity). No decorative jitter.
- **Typographic clarity**: 14px body, 13px secondary, 12px minimum. Use Inter for UI, JetBrains Mono for code.
- **8pt grid**: All spacing is a multiple of 4px. Prefer 8/12/16/24/32.

## Stack Defaults

When building from scratch or when the project has no existing stack:
- **Framework**: React 19 + Next.js App Router
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (base-nova style)
- **Icons**: Lucide React
- **State**: Zustand v5
- **Fonts**: Geist Sans + Geist Mono (or Inter + JetBrains Mono)

When a project already has a stack, follow its conventions exactly.

## Component Patterns

### Spacing
```
p-3 (12px) → small cards, badges, compact items
p-4 (16px) → default cards, sections
p-6 (24px) → large containers, hero sections
gap-2 (8px) → tight element groups
gap-4 (16px) → standard section gaps
gap-6 (24px) → major section separation
```

### Radius
```
rounded-md (8px) → buttons, inputs
rounded-lg (12px) → cards
rounded-xl (16px) → modals, panels
rounded-2xl (24px) → large panels, chat bubbles
rounded-full → avatars, pills
```

### Elevation (dark mode)
```
Level 0: bg-background (#09090B)
Level 1: bg-zinc-900 (#18181B) + border-zinc-800
Level 2: bg-zinc-800 (#27272A) + shadow-sm
Level 3: bg-zinc-700 + shadow-md (modals, dropdowns)
```

### Transitions
```
transition-colors duration-150  → color/bg changes
transition-all duration-200     → multi-property (default)
transition-transform duration-300 ease-out → layout shifts
```

### Hover & Active
```tsx
// Buttons
className="hover:bg-primary/90 active:scale-[0.97] transition-all"
// Cards
className="hover:shadow-md hover:-translate-y-px transition-all"
// Ghost items
className="hover:bg-muted/50 transition-colors"
```

## Anti-Patterns

1. Never use emoji as structural icons. Use Lucide.
2. Never use raw hex colors. Use CSS variables or Tailwind tokens.
3. Never set font-size below 12px (`text-xs`).
4. Never add `hover:` states without `focus-visible:` equivalents.
5. Never use `fixed` positioning without testing mobile viewports.
6. Never skip `prefers-reduced-motion` for animations over 200ms.
7. Never create layout shift — reserve space for async content.
8. Never use color as the only status indicator — pair with icon or text.

## Accessibility Checklist

- `aria-label` on every icon-only button
- `role="status"` on loading indicators
- Focus ring: `focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2`
- Color contrast: 4.5:1 text, 3:1 interactive elements
- Semantic HTML: `<nav>`, `<main>`, `<aside>`, `<section>`, `<header>`
- Skip link: Hidden link to `#main-content` for keyboard users

## References

- `references/design-system.md` — Full color, typography, spacing, shadow, and animation tokens
- `references/component-patterns.md` — Reusable patterns for chat bubbles, inputs, sidebars, cards, badges
