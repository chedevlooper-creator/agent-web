---
name: Atelier Modern
colors:
  surface: '#f9f9ff'
  surface-dim: '#d4daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e8eeff'
  surface-container-high: '#e3e8f9'
  surface-container-highest: '#dde2f3'
  on-surface: '#161c27'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2a303d'
  inverse-on-surface: '#ecf0ff'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5f5e5b'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfdb'
  on-secondary-container: '#636260'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#111c2c'
  on-tertiary-container: '#798499'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e5e2de'
  secondary-fixed-dim: '#c8c6c2'
  on-secondary-fixed: '#1c1c1a'
  on-secondary-fixed-variant: '#474744'
  tertiary-fixed: '#d8e3fa'
  tertiary-fixed-dim: '#bcc7dd'
  on-tertiary-fixed: '#111c2c'
  on-tertiary-fixed-variant: '#3c475a'
  background: '#f9f9ff'
  on-background: '#161c27'
  surface-variant: '#dde2f3'
typography:
  display-lg:
    fontFamily: Bodoni Moda
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Bodoni Moda
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Bodoni Moda
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.15em
spacing:
  unit: 8px
  container-max-width: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  section-gap: 120px
---

## Brand & Style

The design system is anchored in the concept of "Digital Minimalism for High Fashion." It targets a discerning audience that values clarity, exclusivity, and quality over quantity. The aesthetic merges **Minimalism** with **Editorial** sensibilities, utilizing a vast amount of whitespace to treat digital products like curated museum exhibits.

The UI should evoke a sense of calm authority. By stripping away unnecessary ornamentation, the design system allows high-resolution photography and typography to drive the user experience. The interaction model is fluid and intentional, avoiding aggressive animations in favor of subtle, high-end transitions that mimic the pages of a physical luxury magazine.

## Colors

The palette is designed to be a silent backdrop for product imagery.
- **Primary (Black):** Used exclusively for high-priority CTAs, primary headers, and heavy borders to create a stark, authoritative contrast.
- **Secondary (Bone):** The primary background color. It is warmer than pure white, providing a "paper" feel that enhances the editorial tone.
- **Tertiary (Slate):** Used for secondary text, metadata, and subtle dividers.
- **Neutral (Charcoal):** Used for body text to maintain high legibility without the harshness of pure black.
- **Accent (Gold/Muted Sand):** Reserved for limited use, such as "Limited Edition" badges or small interactive highlights.

## Typography

This design system employs a sophisticated pairing of **Bodoni Moda** for a classic, high-fashion editorial feel and **Hanken Grotesk** for utilitarian precision.

- **Display & Headlines:** Use Bodoni Moda. These should be large and given plenty of "breathing room." In desktop layouts, display type can overlap image containers slightly for a layered look.
- **Body Text:** Use Hanken Grotesk. Maintain a generous line height (1.6) to ensure the content feels approachable and easy to digest.
- **Labels:** Always use Hanken Grotesk in uppercase with increased letter spacing. This is used for navigation, categories, and small functional UI elements to differentiate them from narrative content.

## Layout & Spacing

The layout follows a **Fixed Grid** model on desktop, centered within the viewport to create a "lookbook" effect. 

- **Desktop:** 12-column grid with a massive 64px outer margin to frame the content.
- **Mobile:** 4-column grid with 16px margins.
- **Spacing Rhythm:** We use an 8px base unit, but emphasize "Negative Space" as a design element. Section gaps should be significantly larger than standard web apps (up to 120px) to force the user to focus on one story or product at a time.
- **Alignment:** Use asymmetrical layouts for editorial sections, while keeping the shopping grid strictly symmetrical and disciplined.

## Elevation & Depth

To maintain a clean, high-end aesthetic, this design system avoids traditional shadows. Depth is communicated through **Tonal Layers** and **Low-contrast Outlines**.

- **Surface Levels:** The base layer is `Bone`. Overlays (like carts or menus) should use the same color but be separated by a 1px solid `Black` or `Slate` border.
- **Interaction:** Depth is suggested through scale rather than shadow. On hover, an image might subtly scale up within its frame, or a button might fill with solid color.
- **Glassmorphism:** Use sparingly only for top-navigation blurs to ensure readability over scrolling imagery. Use a very subtle blur (4px) with high transparency (90%).

## Shapes

The shape language is **Sharp (0px)**. 

In a luxury context, sharp corners communicate precision, architectural structure, and a premium "cut." All buttons, input fields, and image containers must have 0px border-radii. The only exception to this rule is the use of circular "Pill" shapes for decorative status chips or specific icon backgrounds, though these should be used rarely to maintain the system's geometric rigor.

## Components

### Buttons
- **Primary:** Solid Black background, white Hanken Grotesk text, uppercase, sharp corners.
- **Secondary:** Transparent background, 1px Black border, black text.
- **Ghost:** No background or border, underlined on hover.

### Input Fields
- Underline-only style (1px Slate) for a minimal look, or a full 1px border. 
- Labels should always be in the `label-caps` typography style, positioned above the field.

### Cards
- **Product Cards:** No borders or background. The focus is entirely on the image. Typography (Product Name and Price) is left-aligned beneath the image in `body-sm`.
- **Editorial Cards:** May feature a `Slate` or `Charcoal` background with `Bone` text to create a high-contrast break in the scroll.

### Chips & Tags
- Used for sizes or categories. 1px Slate border, sharp corners, `label-caps` typography.

### Lists
- Clean, 1px horizontal dividers between items. Use generous padding (24px+) between list rows to maintain the airy feel.