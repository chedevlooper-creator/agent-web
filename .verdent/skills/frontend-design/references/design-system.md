# Design System Tokens

## Color Palette

### Light Mode
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

### Dark Mode
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

### Semantic Mapping
- Primary action: Blue gradient `#0066FF → #0052CC`
- AI/Assistant accent: Purple `#8B5CF6`
- Success: Emerald `#10B981`
- Warning: Amber `#F59E0B`
- Error: Red `#EF4444`
- User messages: Primary bg + white text
- Assistant messages: Surface bg + subtle border

## Typography

### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
```

### Scale
| Token      | Size     | Use              |
|-----------|----------|------------------|
| text-xs   | 0.75rem  | Labels, captions |
| text-sm   | 0.8125rem| Secondary text   |
| text-base | 0.875rem | Body text        |
| text-lg   | 1rem     | Subheadings      |
| text-xl   | 1.125rem | Section titles   |
| text-2xl  | 1.5rem   | Page titles      |
| text-3xl  | 1.875rem | Hero text        |

### Weights
- 400 normal — body
- 500 medium — labels, nav
- 600 semibold — headings
- 700 bold — emphasis

## Spacing (8pt Grid)
| Token    | Value   |
|---------|---------|
| space-1 | 4px     |
| space-2 | 8px     |
| space-3 | 12px    |
| space-4 | 16px    |
| space-5 | 20px    |
| space-6 | 24px    |
| space-8 | 32px    |
| space-10| 40px    |
| space-12| 48px    |
| space-16| 64px    |

## Border Radius
| Token       | Value  | Use             |
|------------|--------|-----------------|
| radius-sm  | 6px    | Small elements  |
| radius-md  | 8px    | Buttons, inputs |
| radius-lg  | 12px   | Cards           |
| radius-xl  | 16px   | Modals          |
| radius-2xl | 24px   | Large panels    |
| radius-full| 9999px | Pills, avatars  |

## Shadows
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

## Animation

### Durations
| Token           | Value | Use                 |
|----------------|-------|---------------------|
| duration-instant| 50ms  | Press feedback      |
| duration-fast  | 150ms | Color/hover changes |
| duration-normal| 200ms | Default transitions |
| duration-slow  | 300ms | Layout shifts       |
| duration-slower| 400ms | Page transitions    |

### Easings
```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in: cubic-bezier(0.7, 0, 0.84, 0);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Keyframe Presets
1. Fade In: opacity 0→1, 200ms, ease-out
2. Slide Up: translateY(8px)→0 + fade, 300ms, ease-out
3. Scale In: scale(0.95)→1 + fade, 200ms, ease-spring
4. Pulse Glow: box-shadow pulse for AI thinking state
5. Typing Indicator: 3 dots with staggered bounce
6. Message Appear: Slide from bottom with spring physics
7. Skeleton Shimmer: Left-to-right gradient animation

## Layout

### Page Structure
```
Header (56px, sticky)
├── Sidebar (280px expanded, 64px collapsed)
├── Main Chat Area (flex-1, max-w-3xl centered)
└── Context Panel (320px)
Input Area (auto-height, 64–200px)
```

### Responsive Breakpoints
| Token | Value  | Target       |
|------|--------|-------------|
| sm   | 640px  | Large phones |
| md   | 768px  | Tablets      |
| lg   | 1024px | Laptops      |
| xl   | 1280px | Desktops     |
| 2xl  | 1536px | Large screens|

### Mobile (< 768px)
- Sidebar → overlay drawer
- Context panel → bottom sheet
- Chat → full width, reduced padding
- Input → fixed bottom
