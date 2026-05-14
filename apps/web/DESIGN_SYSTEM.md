# Agent Web Design System

## Overview
Agent Web is an AI agent chat interface with productivity tool features. The design system transforms the UI into a "pro max" level experience with modern aesthetics, smooth micro-interactions, and professional polish.

## Design Philosophy
- **Modern Minimalism** with subtle depth through layered surfaces
- **Glassmorphism accents** for panels and overlays
- **Smooth 60fps animations** with purposeful motion
- **Dark-first design** optimized for long working sessions
- **Accessible by default** with WCAG 2.1 AA compliance

## Color System

### Light Mode Palette
```css
--background: #FAFBFC;
--foreground: #0F1419;
--surface: #FFFFFF;
--surface-elevated: #FFFFFF;
--surface-muted: #F3F4F6;
--primary: #0066FF;
--primary-hover: #0052CC;
--primary-muted: #E6F0FF;
--secondary: #6B7280;
--accent: #8B5CF6;
--accent-muted: #F3E8FF;
--success: #10B981;
--warning: #F59E0B;
--destructive: #EF4444;
--border: #E5E7EB;
--border-muted: #F3F4F6;
```

### Dark Mode Palette
```css
--background: #09090B;
--foreground: #FAFAFA;
--surface: #18181B;
--surface-elevated: #27272A;
--surface-muted: #1F1F23;
--primary: #3B82F6;
--primary-hover: #60A5FA;
--primary-muted: #1E3A5F;
--secondary: #A1A1AA;
--accent: #A78BFA;
--accent-muted: #3B2F5C;
--success: #34D399;
--warning: #FBBF24;
--destructive: #F87171;
--border: #27272A;
--border-muted: #1F1F23;
```

### Semantic Colors
- **Primary Action**: Blue gradient (#0066FF → #0052CC)
- **AI/Assistant accent**: Purple (#8B5CF6)
- **Success states**: Emerald (#10B981)
- **Warning states**: Amber (#F59E0B)
- **Error/Danger states**: Red (#EF4444)
- **User messages**: Primary blue with white text
- **Assistant messages**: Surface with subtle border

## Typography System

### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
```

### Type Scale
```css
--text-xs: 0.75rem;      /* 12px - Labels, captions */
--text-sm: 0.8125rem;    /* 13px - Secondary text */
--text-base: 0.875rem;   /* 14px - Body text */
--text-lg: 1rem;         /* 16px - Subheadings */
--text-xl: 1.125rem;     /* 18px - Section titles */
--text-2xl: 1.5rem;      /* 24px - Page titles */
--text-3xl: 1.875rem;    /* 30px - Hero text */
```

### Line Heights
```css
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

## Spacing System (8pt Grid)

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

## Border Radius

```css
--radius-sm: 0.375rem;   /* 6px - Small elements */
--radius-md: 0.5rem;     /* 8px - Default elements */
--radius-lg: 0.75rem;    /* 12px - Cards */
--radius-xl: 1rem;       /* 16px - Modals */
--radius-2xl: 1.5rem;   /* 24px - Large panels */
--radius-full: 9999px;   /* Pills, avatars */
```

## Shadow System

### Elevation Levels
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
--shadow-glow: 0 0 20px rgb(0 102 255 / 0.15);
--shadow-glow-accent: 0 0 20px rgb(139 92 246 / 0.15);
```

### Glassmorphism
```css
--glass-bg: rgb(255 255 255 / 0.8);
--glass-border: rgb(255 255 255 / 0.2);
--glass-blur: blur(12px);
--glass-shadow: 0 8px 32px rgb(0 0 0 / 0.1);
```

## Animation System

### Durations
```css
--duration-instant: 50ms;
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-slower: 400ms;
```

### Easings
```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in: cubic-bezier(0.7, 0, 0.84, 0);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Key Animations
1. **Fade In**: opacity 0→1, duration 200ms, ease-out
2. **Slide Up**: translateY(8px)→0, opacity 0→1, duration 300ms, ease-out
3. **Scale In**: scale(0.95)→1, opacity 0→1, duration 200ms, ease-spring
4. **Pulse Glow**: box-shadow pulse animation for AI thinking state
5. **Typing Indicator**: Three dots with staggered bounce animation
6. **Message Appear**: Slide in from bottom with spring physics
7. **Skeleton Shimmer**: Gradient animation for loading states

## Component Specifications

### Chat Bubbles
- **User bubble**: Primary color background, white text, rounded-2xl, padding 12px 16px
- **Assistant bubble**: Surface color, border, rounded-2xl, padding 12px 16px, max-width 85%
- **Avatar**: 32px circle, 2px border matching role color
- **Code blocks**: Dark theme (vscDarkPlus), rounded-lg, max-height 400px with scroll

### Input Area
- **Container**: Surface elevated, rounded-xl, border, padding 12px 16px
- **Focus state**: Ring-2 primary/30, border primary
- **Textarea**: Auto-grow, max 8 rows, font-size 14px
- **Send button**: 32px square, rounded-xl, primary gradient, icon 16px

### Sidebar
- **Width**: 280px expanded, 64px collapsed
- **Session item**: Height 44px, rounded-lg, hover background transition
- **Active state**: Primary muted background, left border accent
- **Collapse animation**: Width transition 300ms, content fade 150ms

### Panels (Context/Settings)
- **Width**: 320px
- **Background**: Surface with subtle glassmorphism on scroll
- **Header**: Sticky, blur backdrop
- **Tab bar**: Icon-only with tooltips, active indicator underline

### Buttons
- **Primary**: Gradient background, white text, shadow-sm, hover shadow-md
- **Secondary**: Surface background, border, hover surface-muted
- **Ghost**: Transparent, hover surface-muted
- **Icon**: 32px or 40px square, rounded-lg
- **Press state**: scale(0.97), 50ms transition
- **Disabled**: opacity 0.5, cursor not-allowed

### Cards
- **Background**: Surface, rounded-xl
- **Border**: 1px border-muted
- **Shadow**: shadow-sm
- **Hover**: shadow-md, slight translateY(-1px)
- **Padding**: 16px default, 12px small variant

### Badges
- **Size**: Height 20px, padding 0 8px
- **Border radius**: full (pill)
- **Variants**: default (primary muted), secondary, destructive, outline

## Layout System

### Page Structure
```
┌─────────────────────────────────────────────────────┐
│ Header (56px, sticky)                               │
├──────────┬─────────────────────────────┬────────────┤
│ Sidebar  │ Main Chat Area              │ Context    │
│ (280px)  │ (flex-1, max-w-3xl)        │ Panel      │
│          │                             │ (320px)    │
│          │                             │            │
│          │                             │            │
├──────────┴─────────────────────────────┴────────────┤
│ Input Area (auto-height, min 64px, max 200px)       │
└─────────────────────────────────────────────────────┘
```

### Responsive Breakpoints
```css
--breakpoint-sm: 640px;   /* Large phones */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Small laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Large screens */
```

### Mobile Layout (< 768px)
- Sidebar: Overlay drawer, full height
- Context panel: Bottom sheet
- Chat: Full width, reduced padding
- Input: Fixed bottom

## Accessibility Guidelines

### Color Contrast
- Text on background: Minimum 4.5:1
- Large text: Minimum 3:1
- Interactive elements: 3:1 against adjacent colors
- Focus indicators: 3:1 minimum

### Focus States
- Visible focus ring: 2px offset, primary color
- Focus visible only on keyboard navigation
- Skip links for main content

### Motion
- Respect `prefers-reduced-motion`
- Alternative static states for complex animations
- Duration cap: 400ms for complex transitions

### Screen Readers
- Semantic HTML structure
- ARIA labels for icon-only buttons
- Live regions for dynamic content
- Role="status" for loading states

## Anti-Patterns to Avoid

1. **No emoji as structural icons** - Use Lucide/Phosphor icons
2. **No jarring color changes** - Smooth transitions only
3. **No layout shift on load** - Reserve space for async content
4. **No hover-only interactions** - Always have click/tap alternative
5. **No horizontal scroll** - Use vertical layouts
6. **No text under 12px** - Minimum 12px for any text
7. **No color-only meaning** - Always add icon or text for status
8. **No infinite loading** - Always show progress or timeout
