# Kronos UI Guide

## Design tokens
- `--kronos-bg-*`: monochrome backgrounds for app, surfaces, cards.
- `--kronos-border-*`: subtle, strong, and glowing borders used for glass panels and chips.
- `--kronos-text-*`: neon white, muted grey, and dim text for hierarchy.
- `--kronos-radius-*`: shared card/pill radii.
- `--kronos-shadow-*`: soft drop shadows and neon glows.
- `--kronos-transition-*`: motion timing for hover/fade transitions.

> Use the `--kronos-*` tokens instead of hard-coded colors to keep the console consistent.

## Components
- **AppShell**: wraps every route (`app/layout.tsx`) and wires the sidebar, centered glass window (`kronos-glass-card`), and timeline panel. Changing this grid can break the shell, so keep the sidebar/main/timeline order intact.
- **Sidebar**: `components/layout/Sidebar.tsx` renders the nav column with `kronos-sidebar-link`s. Hover/focus/glow states rely on the CSS classes defined in `globals.css`.
- **TimelinePanel**: displays the live event log with highlight animation for new entries via `kronos-timeline-entry--new`.
- **GlassCard**: reusable wrapper with glass background and `kronos-fade-slide` animation; use it anywhere you need a Kronos panel.
- **SectionTitleBar**: standard header with title, description, and optional chips (`kronos-chip`), used inside dashboard and desktop cards.
- **ChatInput**: accepts `successFlash` to trigger the submit animation defined by `kronos-submit-success`.

## Motion & accessibility
- Prefer `kronos-fade-slide`, `kronos-toast-in`, and `kronos-entry-flash` keyframes for subtle transitions.
- Focus states rely on `:focus-visible` styles for `.kronos-` elements; keep those class names when creating new buttons or links.
- Reduced motion users skip animations via the `@media (prefers-reduced-motion: reduce)` block near the bottom of `globals.css`.

## Tips
- Keep the remote desktop canvas inside `GlassCard`/`kronos-remote-frame` to maintain the neon border and toolbar.
- Use the new toast (`kronos-toast`) for brief confirmations; it will auto-dismiss.
