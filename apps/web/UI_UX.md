# Agent Web UI/UX Guide

## Purpose

This document defines the user experience contract for Agent Web. Use it with
`DESIGN_SYSTEM.md`: the design system defines tokens and component styling; this
guide defines how screens should behave, how flows should feel, and how UI work
should be reviewed before shipping.

Agent Web is a dark-first AI agent workspace for long-form chat, model
comparison, file context, skills, and session management. The interface should
feel fast, focused, technical, and calm. It should avoid marketing-page patterns
and prioritize a working cockpit: dense enough for repeated use, but still easy
to scan under pressure.

## Product Experience Principles

1. **Conversation is the primary surface.** The chat transcript and composer are
   always the center of gravity. Navigation, settings, tools, and context should
   support the conversation without competing with it.
2. **State must be visible.** Users should always know whether the app is ready,
   streaming, comparing models, missing an API key, uploading files, or handling
   an error.
3. **Power features stay discoverable.** Skills, tools, file attachments,
   session actions, and model comparison need visible affordances and clear
   states, not hidden hover-only behavior.
4. **Technical density is allowed.** Monospace labels, compact controls, and
   system-like panels fit the product. Density should never reduce legibility,
   touch target size, or keyboard access.
5. **Motion explains causality.** Animations should clarify state changes:
   messages appear, panels slide, streaming pulses, and loading skeletons reserve
   space. Motion should not be decorative noise.
6. **Dark mode is the baseline.** Light mode may exist, but dark mode is the
   quality bar. Contrast, focus, borders, dividers, and muted text must be tested
   in dark mode independently.

## Target Users

- Developers and technical operators using AI agents during active work.
- Users comparing model outputs and iterating quickly across sessions.
- Users who attach files or rely on persisted context and need confidence that
  the app is using the right inputs.
- Users who spend long sessions in the app, where eye strain, keyboard flow, and
  recoverable errors matter more than visual novelty.

## Information Architecture

### Primary Regions

- **Sidebar:** session history, navigation tabs, tools, activity, and context
  entry points.
- **Top bar:** product identity, global layout controls, and settings access.
- **Chat stage:** transcript, empty state, streaming state, comparison result
  layout, tool cards, and errors.
- **Composer:** file attachment, text input, send action, compare mode indicator,
  attached file chips, and secondary status text.
- **Settings panel:** provider, model, compare mode, configured models, API key
  state, and operational configuration.

### Navigation Rules

- Keep the chat route as the default first screen.
- Session selection should preserve scroll and make the active session visually
  obvious.
- Destructive session actions must be spatially separated from session selection
  and require either confirmation or an undo path.
- Settings open as a panel or sheet, not a full page, because configuration is
  secondary to the conversation.

## Core User Flows

### Start a New Chat

1. User lands on the chat stage.
2. Empty state communicates readiness without long instructions.
3. Starter prompts are optional accelerators, not marketing copy.
4. Composer is immediately focusable and usable by keyboard.
5. Sending a first message creates or selects a session and shows streaming
   feedback without layout jump.

### Continue a Session

1. User selects a session from the sidebar.
2. Active state updates immediately.
3. Messages load with a stable skeleton or brief busy state.
4. The transcript scrolls to the newest message unless the user has intentionally
   navigated upward.
5. The user can recover context from timestamps, model badges, tool cards, and
   file chips.

### Send a Message

1. User enters text, attaches optional files, and presses send or keyboard
   shortcut.
2. Send button disables during submission, with spinner or streaming state.
3. User message is appended immediately.
4. Assistant placeholder reserves space and shows model/status metadata.
5. Streaming content updates progressively.
6. Completion restores composer readiness and announces status via polite live
   region.

### Compare Models

1. User enables compare mode in settings.
2. Composer clearly shows compare mode before submission.
3. The result layout presents comparable model outputs side by side on desktop
   and stacked on mobile.
4. Model labels remain sticky enough to identify each answer while scrolling.
5. Errors from one model should not hide successful output from the other model.

### Attach Files

1. Attachment control is visible and keyboard accessible.
2. File chips show name, status, and removal action.
3. Upload or preview failures identify the affected file and give a retry or
   remove path.
4. Attached file chips must not push the composer into an unusable height on
   small screens.

### Recover from Errors

1. Error text appears near the failed message or control.
2. User gets a concrete recovery action: retry, edit, remove file, change model,
   or configure API key.
3. Failed assistant messages keep enough context for retry.
4. Errors are announced with accessible semantics and do not trap focus.

## Screen and Component UX Rules

### Shell and Layout

- Preserve a full-height app shell using `min-h-dvh` and safe-area padding.
- Main content must not horizontally scroll at 360px width.
- Fixed and sticky regions must reserve space so transcript content is not hidden
  behind the composer or top bar.
- Avoid page-level floating cards. The app should feel like a contained
  workspace, not stacked marketing sections.

### Sidebar

- Expanded width should support readable session titles; collapsed state should
  preserve icon-only navigation with labels available by tooltip or accessible
  name.
- Active tabs and sessions need more than color: use border, indicator, or
  surface change.
- Hover-revealed destructive controls also need keyboard access.
- Empty sidebar states should be short and useful.

### Top Bar

- Keep the top bar compact and persistent.
- Icon buttons require accessible labels and visible focus states.
- Product identity should stay visible but not dominate the workspace.
- Global controls should not shift position between loading and ready states.

### Chat Transcript

- User and assistant messages must have distinct alignment, avatar treatment,
  and surface styling.
- Long markdown content should stay readable: sensible line length, table
  overflow handling, code block scroll, and preserved whitespace where needed.
- Tool cards should be collapsible, keyboard operable, and visually subordinate
  to the natural-language answer.
- Streaming messages should reserve enough space to prevent cumulative layout
  shift.
- Scroll-to-bottom appears only when useful and should not block message text.

### Composer

- The composer is the most important control in the app. It must remain visible,
  stable, and reachable.
- Textarea auto-grow should cap height before it harms transcript visibility.
- Send is disabled when there is no actionable input or while a request is
  already in flight.
- Attachment and send controls should meet at least 44px touch target guidance,
  even when the visual icon is smaller.
- Keyboard behavior should be predictable: typing never loses focus unexpectedly,
  and submission shortcuts should not prevent multiline entry.

### Settings Panel

- Settings are grouped by task: provider, compare mode, models, API key state.
- Current selections need clear selected states using icon/text plus color.
- API key warnings should be actionable without leaking secrets or implying the
  key is stored client-side.
- The panel must trap focus while open and return focus to the trigger on close.
- Escape and outside click should close only when doing so would not discard
  unsaved changes.

### Empty, Loading, and Success States

- Empty states should be quiet and task-oriented.
- Loading longer than 300ms needs visible feedback.
- Loading longer than 1s should use skeletons or streaming placeholders instead
  of an indefinite spinner alone.
- Success states should be brief and should not interrupt the next action.

## Responsive Behavior

Validate meaningful breakpoints rather than only desktop:

- **360x800:** compact mobile minimum.
- **390x844:** standard mobile.
- **430x932:** large mobile.
- **600x960:** foldable or small tablet.
- **820x1180:** tablet portrait.
- **1024x768:** tablet landscape or small laptop.
- **1366x768:** laptop.
- **1440x900:** desktop.
- **1920x1080:** wide desktop.

Responsive rules:

- Mobile sidebar becomes an overlay drawer.
- Settings panel becomes a sheet or full-height overlay with safe-area padding.
- Compare mode stacks model outputs on narrow screens.
- Tables and code blocks scroll within their own bounds without causing page
  overflow.
- Composer controls wrap or compact before text becomes clipped.
- Touch targets and focus rings remain visible at every breakpoint.

## Accessibility Requirements

- Body text contrast must meet WCAG AA: 4.5:1 for normal text and 3:1 for large
  text.
- Interactive controls must have keyboard focus states with at least 3:1 contrast
  against adjacent colors.
- Icon-only buttons require an accessible name.
- Do not rely on color alone for active, error, success, or selected states.
- Maintain semantic headings and landmarks, including skip-to-main behavior.
- Dynamic message updates should use polite live regions where appropriate.
- Dialogs and panels require focus management: initial focus, focus trap, Escape
  handling, and focus restoration.
- Respect `prefers-reduced-motion`; provide static alternatives for animated
  loading and decorative motion.
- Forms and inputs need visible labels or screen-reader labels, helper text where
  useful, and inline error placement.

## Interaction and Motion

- Micro-interactions should generally run from 150ms to 300ms.
- Use `transform` and `opacity` for animated state changes; avoid animating
  layout properties such as width, height, top, or left unless there is a strong
  reason.
- Pressed states can use a small translate or scale, but must not cause layout
  jitter.
- Panel motion should communicate direction: sidebar from the side, sheet from
  the bottom, modal from source or center.
- Streaming and typing indicators should feel alive but subtle enough for long
  work sessions.
- All motion must be interruptible by user action.

## Content and Microcopy

- Use concise operational language: "Retry", "Remove file", "Configure API key",
  "Compare mode", "New chat".
- Avoid long instructional copy inside the app. Documentation belongs in docs,
  not inside the primary workflow.
- Error messages should include cause and recovery path.
- Empty states should invite action without exaggeration.
- Keep labels stable so users can build muscle memory.
- Use technical terms when they are accurate, but avoid unexplained internal
  implementation terms.

## Visual Quality Guardrails

- Use the semantic tokens from `DESIGN_SYSTEM.md` instead of raw colors in
  components.
- Keep iconography in a single family, currently Lucide where available.
- Avoid emoji as structural UI icons.
- Keep border radii, shadows, and glass effects consistent with the design
  system.
- Cards are for repeated items, tool cards, messages, modals, or framed controls;
  avoid nesting cards inside cards.
- Do not introduce large decorative gradients, orbs, or background effects that
  compete with the workspace.
- Use monospace styling for system metadata, token-like labels, model names, and
  technical counters; use readable sans text for body content.

## QA Checklist

Before merging UI/UX changes:

- [ ] Chat, composer, sidebar, and settings remain usable at 360px width.
- [ ] No horizontal page scroll appears on mobile.
- [ ] Keyboard navigation reaches every interactive control in a logical order.
- [ ] Focus states are visible in dark mode.
- [ ] Icon-only controls have accessible labels.
- [ ] Loading, streaming, empty, error, and success states are represented.
- [ ] Compare mode works on desktop and mobile layouts.
- [ ] Attached file chips handle long names and removal actions.
- [ ] Code blocks and markdown tables do not break the layout.
- [ ] Reduced-motion mode does not remove essential state feedback.
- [ ] Dark mode contrast is checked independently from light mode.
- [ ] Any new text fits inside its container without clipping.

## Implementation Notes

- Keep UI source in `apps/web/app`, `apps/web/components`, and `apps/web/lib`;
  do not introduce a `src/` folder.
- Follow existing shadcn/ui and local component patterns before adding new
  abstractions.
- Use Lucide icons for controls when an icon is needed.
- When changing Next.js app behavior, read the relevant local Next.js 16 docs in
  `node_modules/next/dist/docs/` first.
- Build packages before relying on the web app production build if shared package
  types or compiled outputs changed.
