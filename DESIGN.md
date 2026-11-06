# CryptoPlexTrade Design System

## Stack
- Framework: server-rendered HTML with vanilla CSS and JavaScript, served by Express
- Styling: shared CSS tokens, customer portal styles, and a dedicated admin stylesheet
- Components: existing HTML/CSS patterns and native form controls
- Animation: CSS transitions with reduced-motion support
- Icons: inline SVG

## Tokens
- Brand: royal blue `#005baa`, cyan `#00a9e0`
- Canvas: white with soft blue-gray section surfaces
- Text: deep navy `#0a192c`, secondary slate `#3e5369`
- Radius: compact controls 8-10px; larger panels follow existing tokens
- Layout: shared responsive breakpoints at 1023px, 900px, 768px, and 640px

## Decisions
- 2026-11-06: Keep the established Clarity brand and improve responsive behavior through shared styles.
- 2026-11-06: Custom dropdowns must stay within the viewport, support keyboard navigation, and expose expanded/selected state.
- 2026-11-06: Customer and admin portals share spacing, focus, and control behavior while retaining their separate shells.
- 2026-11-06: Buy and sell previews use configured GHS/USD platform rates plus a fresh, sourced market spot; fallback prices disable order continuation.
- 2026-11-06: Sell payout math accepts crypto units and computes USD value and GHS payout server-side; unit tests cover BTC, USDT, and invalid rates.
- 2026-11-06: Compact homepage layouts omit the fixed market ticker and place the quote action in the first viewport; reduced-motion users do not receive decorative loops.
- 2026-11-06: Login redirects preserve only the requested same-site protected page so a trade draft resumes after authentication.

## Components
- Customer portal shell, trade terminal, order summaries, tables, and custom asset/filter dropdowns
- Admin rail, topbar, data tables, filters, and custom status dropdowns

## Non-Goals
- No framework migration or replacement of established page flows
- No invented live activity or unsupported operational claims