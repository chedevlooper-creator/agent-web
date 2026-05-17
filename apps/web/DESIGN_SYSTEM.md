# Agent Web Design System

> **Tone:** Dark-first signal terminal with modern glassmorphism accents.
> **Philosophy:** Brutalist clarity meets refined micro-interactions.
> **Primary palette root:** `--primary: #00e599` (emerald green), `--accent: #ff6b35` (ember orange).

---

## 1. Design Tokens

### 1.1 Color Tokens

All colors are CSS custom properties in `:root` within `globals.css`. Components use `var(--token-name)` or Tailwind `text-[var(--token)]` — never raw hex values in components.

#### Core

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0b0b0d` | Page backdrop, near-black |
| `--foreground` | `#ededf0` | Primary text |
| `--surface` | `#0f0f12` | Sidebar, card base |
| `--surface-elevated` | `#16161b` | Elevated surfaces, hover states |
| `--surface-muted` | `#0b0b0d` | Muted surface |
| `--overlay` | `#1a1a22` | Dropdowns, popovers |
| `--dim-foreground` | `#6b6b7b` | Secondary text, labels |

#### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#00e599` | Primary action, accents, key lines |
| `--primary-dim` | `#00c982` | Primary hover |
| `--primary-hover` | `#00c982` | Primary hover alias |
| `--primary-muted` | `#0a2a1e` | Primary background (low opacity) |
| `--primary-foreground` | `#0b0b0d` | Text on primary backgrounds |
| `--accent` | `#ff6b35` | Secondary actions, compare mode |
| `--accent-dim` | `#d95727` | Accent hover |
| `--accent-muted` | `#2a140a` | Accent background (low opacity) |
| `--accent-foreground` | `#ffffff` | Text on accent backgrounds |

#### Feedback

| Token | Value | Usage |
|-------|-------|-------|
| `--destructive` | `#ff453a` | Errors, destructive actions |
| `--success` | `#00e599` | Success states (same as primary) |
| `--warning` | `#ffb800` | Warnings |
| `--info` | `#5e9eff` | Informational |

#### Borders & Inputs

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `#22222e` | Default borders |
| `--border-strong` | `#343444` | Elevated borders, active states |
| `--input` | `#1a1a22` | Input backgrounds |
| `--ring` | `#00e599` | Focus ring |

#### Extended Palette (Electric/Cyan/Magenta family)

| Token | Value | Usage |
|-------|-------|-------|
| `--electric` | `#b0e22d` | Lime green accent (new components) |
| `--electric-hover` | `#9ccc21` | Electric hover |
| `--electric-muted` | `#1a2e00` | Electric background |
| `--cyan` | `#22d3ee` | Cyan accent |
| `--cyan-muted` | `#063340` | Cyan background |
| `--magenta` | `#e879f9` | Magenta accent |
| `--magenta-muted` | `#2d0a3a` | Magenta background |
| `--amber` | `#f59e0b` | Amber accent |
| `--amber-muted` | `#2a1f00` | Amber background |
| `--teal` | `#2dd4bf` | Teal accent |
| `--teal-muted` | `#0a2a25` | Teal background |

### 1.2 Typography

**Primary Font:** `Geist` (via Next.js font, CSS variable `--font-geist-sans`)

**Mono Font:** `Geist Mono` (via Next.js font, CSS variable `--font-geist-mono`)

Fallback chain: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`

#### Type Scale

| Level | Size | Weight | Letter-spacing | Usage |
|-------|------|--------|----------------|-------|
| agent wordmark | 6xl-8xl | 900 | 0 | Welcome hero title |
| h1-h3 | 1rem-1.5rem | 600 | 0 | Section headings |
| body | 0.875rem (14px) | 400 | 0.01em | Chat content |
| body small | 0.8125rem (13px) | 400 | 0.05em | General UI |
| small/meta | 0.625rem-0.75rem (10-12px) | 500-700 | 0.1-0.15em | Labels, badges, badges |
| mini/mono | 0.625rem (10px) | 500-700 | 0.08-0.15em | Status, timestamps, keys |

### 1.3 Spacing Scale

Based on 4px grid. Use `var(--token)` or Tailwind utilities.

| Step | px | rem | Tailwind |
|------|----|-----|----------|
| 1 | 4px | 0.25rem | `p-1` |
| 2 | 8px | 0.5rem | `p-2` |
| 3 | 12px | 0.75rem | `p-3` |
| 4 | 16px | 1rem | `p-4` |
| 5 | 20px | 1.25rem | `p-5` |
| 6 | 24px | 1.5rem | `p-6` |
| 7 | 32px | 2rem | `p-8` |
| 8 | 48px | 3rem | `p-12` |

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `2px` (legacy), migrating to `6px` | Base radius |
| `--radius-sm` | `2px` | Micro elements |
| `--radius-md` | `4px` | Small cards |
| `--radius-lg` | `6px` | Cards, panels (target) |
| `--radius-xl` | `8px` | Composer, modals |

> **Migration target:** All components moving to `6px` base (`--radius-lg`) for a modern feel while keeping a slight edge.

### 1.5 Shadows & Elevation

| Token | Value | Usage |
|-------|-------|-------|
| message card | `0 10px 26px rgba(0,0,0,0.2)` | Assistant message cards |
| user card | `0 10px 24px rgba(0,229,153,0.12)` | User message cards |
| composer | `0 -12px 36px rgba(0,0,0,0.28)` | Chat input composer |
| sidebar | `4px 0 20px rgba(0,0,0,0.3)` | Sidebar |
| settings | `0 0 40px rgba(0,0,0,0.55)` | Settings panel |

### 1.6 Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition` | `150ms cubic-bezier(0.16, 1, 0.3, 1)` | Default |

Standard durations:
- **Micro-interactions:** 80ms (color/background changes)
- **Standard:** 150ms (hover, focus, border)
- **Animations:** 200-300ms (slide, fade, scale)
- **Message entry:** 250-350ms

---

## 2. Component Categories

### 2.1 Signature Components (Shell)

These define the visual identity. They use `signal-` CSS class prefix.

| Class | Element | Description |
|-------|---------|-------------|
| `.signal-shell` | body wrapper | 100dvh, flex, z-index root |
| `.signal-frame` | inner frame | Full viewport with flex row |
| `.signal-topbar` | top header bar | 44px, border-bottom, flex row |
| `.signal-topbar-label` | header text | Mono, 10px, uppercase, 0.15em tracking |
| `.signal-button` | utility button | 24px height, mono, uppercase, border-box |
| `.signal-ready` | status indicator | Centered mono text with caret |
| `.signal-caret` | blinking cursor | 7x13px block, blink animation |
| `.signal-led` | status LED | 5px square, pulse animation |

### 2.2 Chat Components

| Class | Element | Description |
|-------|---------|-------------|
| `.agent-chat-stage` | chat container | Full flex column, grid bg overlay |
| `.agent-empty-state` | empty welcome | Centered flex column |
| `.agent-message-row` | message wrapper | Flex row with gap |
| `.agent-message-body` | message content | Flex column, width constrained |
| `.agent-message-card` | message card | Bordered card with shadow |
| `.agent-message-card[data-role="user"]` | user message | Green bg, green border |
| `.agent-message-card--error` | error message | Red-tinted border |
| `.agent-avatar-cube` | avatar | 36x36px, 3D cube aesthetic |
| `.agent-avatar-cube--user` | user avatar | Green bg, green border |
| `.agent-avatar-cube--assistant` | assistant avatar | Elevated dark bg |
| `.agent-composer` | input area | Glass overlay, focus glow |
| `.agent-send-button` | send button | Primary bg with shadow |
| `.agent-tool-card` | tool call card | Compact bordered card |
| `.agent-model-badge` | model badge | Mono, uppercase, 10px |
| `.agent-status-badge` | status badge | "running" etc. |
| `.agent-compare-badge` | compare mode badge | Accent-colored |
| `.agent-file-badge` | file attachment badge | Compact pill |
| `.agent-starter-prompt` | starter button | Quick prompt chip |
| `.agent-scroll-button` | scroll-to-bottom | Floating button |

### 2.3 New Component Classes (Electric/Cyan family)

These are used by refactored components and need CSS definitions:

| Class | Element | Description |
|-------|---------|-------------|
| `.glass-card` | card variant | Glass morphism effect |
| `.glass-strong` | strong glass | More opaque glass |
| `.composer-frame` | input compos | Rounded, glass input area |
| `.matrix-field` | background | Grid/matrix animation |
| `.matrix-horizon` | horizon line | Scan line effect |
| `.matrix-card` | starter card | Bordered card with hover glow |
| `.scanline` | scan overlay | CRT scan line |
| `.section-label` | section label | Small uppercase label |

### 2.4 UI Primitives

Located in `apps/web/components/ui/`:

| Component | Description |
|-----------|-------------|
| `Badge` | Inline label/tag |
| `Button` | Action button with variants |
| `Card` | Content card with header/body/footer |
| `ScrollArea` | Custom scrollable container |
| `Separator` | Visual divider |
| `Skeleton` | Loading placeholder |
| `Textarea` | Multi-line text input |
| `Tooltip` | Hover/focus tooltip |

---

## 3. Layout System

### 3.1 Page Shell

```
┌──────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────────┐  │
│  │          │  │  Topbar (44px)   │  │
│  │ Sidebar  │  ├──────────────────┤  │
│  │ (288px)  │  │                  │  │
│  │ or 56px  │  │  Chat Content    │  │
│  │          │  │  (flex-1)        │  │
│  │          │  │                  │  │
│  │          │  ├──────────────────┤  │
│  │          │  │  Composer        │  │
│  └──────────┘  └──────────────────┘  │
└──────────────────────────────────────┘
```

- Sidebar: `var(--sidebar-width)` = 288px expanded, 56px collapsed
- Topbar: fixed 44px
- Composer: auto-height, max 320px textarea
- Content: flex-1 with overflow-y-auto

### 3.2 Breakpoints

| Name | Width | Notes |
|------|-------|-------|
| Mobile | < 640px | Sidebar overlays, single column |
| Tablet | 640-1024px | Sidebar visible, 2-col compare |
| Desktop | > 1024px | Full layout, side-by-side compare |

### 3.3 Message Layout

Messages alternate row direction:
- **User:** `flex-row-reverse` (avatar right, bubble right-aligned)
- **Assistant:** `flex-row` (avatar left, bubble left-aligned)

Max bubble widths:
- Mobile: 86% (user), 90% (assistant)
- Tablet: 75% (user), 82% (assistant)
- Desktop: 76% (user, max 720px), 76% (assistant, max 760px)

---

## 4. Animation System

### 4.1 Core Animations

All defined in `globals.css` and/or `tailwind.config.ts`:

| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
| `fade-in` | 200ms | ease-out | Modals, overlays, panels |
| `slide-up` | 200-300ms | ease-out | Messages, cards appearing |
| `slide-down` | 200-250ms | ease-out | Dropdowns, tooltips |
| `slide-in-right` | 200ms | ease-out | Settings panel |
| `scale-in` | 200ms | spring | Composer focus, buttons |
| `message-in` | 250-350ms | spring | Individual messages |
| `shimmer` | 1.6s | linear | Loading states |
| `typing-dot` | 1.2s | ease-in-out | Typing indicator |
| `cursor-blink` | 1s | step-end | Terminal cursor |
| `led-pulse` | 2s | ease-in-out | Status LED |
| `glow-pulse` | 2.5s | ease-in-out | Glow effects |

### 4.2 Motion Guidelines

- All animations respect `prefers-reduced-motion: reduce`
- Micro-interactions: 80-150ms (color transitions, transform)
- Standard transitions: 150ms (border, shadow)
- Entry animations: 200-300ms (staggered by 30ms per item)
- Only animate `transform` and `opacity` — never `width`, `height`, `top`, `left`

---

## 5. Iconography

- **Icon set:** Lucide React (`lucide-react`)
- **Stroke:** Consistent 1.5px (default Lucide)
- **Usage:** SVGs only — never emoji as icons
- **Sizes:**
  - Inline: 11-12px
  - Small: 14-16px
  - Medium: 18-20px
  - Large: 24px+

---

## 6. Accessibility

### 6.1 Minimum Standards

| Requirement | Standard |
|-------------|----------|
| Color contrast | 4.5:1 (normal text), 3:1 (large text) |
| Focus rings | `outline: 1px solid var(--primary); outline-offset: 2px` |
| Touch targets | 44x44px minimum (mobile) |
| Keyboard nav | Full tab order, no keyboard traps |
| Skip link | Present in layout (`#main-content`) |

### 6.2 ARIA

- Modals/dialogs: `role="dialog"`, `aria-modal="true"`, `aria-label`
- Buttons: `aria-label` for icon-only buttons
- Tabs: `role="tablist"`, `role="tab"`, `aria-selected`
- Live regions: `aria-live="polite"` for streaming content
- Status: `role="status"` for typing indicator

---

## 7. Dark Mode

Always-on dark mode. No light mode toggle. Color scheme: `dark`.

The background is `#0b0b0d` (near-black) with subtle grid overlay:
```css
body::before {
  background-image: radial-gradient(circle, var(--border) 0.5px, transparent 0.5px);
  background-size: 16px 16px;
  opacity: 0.45;
}
```

---

## 8. Coding Standards

### 8.1 CSS

- Use CSS custom properties for all colors, radii, shadows
- Component-specific classes use `agent-*` prefix
- Shell classes use `signal-*` prefix
- Avoid `@apply` — use Tailwind utilities or raw CSS
- Global styles only in `globals.css`

### 8.2 React Components

- Use `"use client"` for interactive components
- Prefer shadcn/ui primitives over custom
- Import pattern: `import { cn } from "@/lib/utils"`
- Style pattern: `className={cn("base", condition && "conditional")}`
- Tooltip pattern: `TooltipIconButton` wrapper for icon buttons

### 8.3 State

- Global state: Zustand store at `lib/store.ts`
- UI preferences (sidebar, theme, provider): persist to localStorage under `"agent-web-ui-prefs"`
- All other state: REST API via `/api/sessions/...`

---

## 9. Anti-Patterns

| Pattern | Instead Use |
|---------|-------------|
| Raw hex colors in components | CSS custom properties via `var(--token)` |
| Emoji as icons | Lucide SVG icons |
| Inline styles | CSS classes or `cn()` |
| Duplicate component definitions | Shared, imported components |
| Mixed border radius values | One of the radius tokens |
| Animating layout properties | `transform` and `opacity` only |
| Placeholder-only form labels | Visible `<label>` element |
| Color-only indicators | Icon + color + text |

---

*Last updated: 2026-05-17*
