## UI Audit Report — 2026-11-06

### Verdict

I would not currently describe this as a finished $20,000-grade exchange experience. That is not a monetary valuation: project price depends on scope, integrations, security, operations, and delivery. As a customer-facing product review, the current result is **4.4 / 10**. The previous changes improved responsive containment and dropdown keyboard behavior, but they did not establish premium transaction correctness or a coherent final visual system.

### Score: 4.4 / 10

| Category | Score | Notes |
|---|---:|---|
| Visual Hierarchy | 5.5 / 10 | Homepage headline and primary trade CTA are findable. Several competing badges, stats, tickers, and floating UI treatments dilute the main task. |
| Typography | 5.5 / 10 | Generally readable, but the Inter/JetBrains Mono pairing, small uppercase labels, and dense finance copy feel like a familiar crypto template rather than a distinctive brand system. |
| Depth & Layering | 4.5 / 10 | Repeated glows, gradients, shadows, glass-like panels, floating badges, and rounded pills compete instead of creating a consistent depth model. |
| Interactive States | 3.5 / 10 | Custom asset dropdown keyboard selection works. The homepage sell preview has incorrect input/output semantics and hard-coded conversion rates; the trade page can report rates unavailable while its label still says live. |
| Responsiveness | 5 / 10 | Sampled pages fit the viewport at 1440, 1024, 768, and 390px, but at 390px the fixed ticker covers part of the homepage sell toggle. No-overflow alone is not a successful mobile usability check. |
| Accessibility | 4 / 10 | Shared reduced-motion handling and visible field labels exist. The trade asset/network selector labels are not programmatically associated, numeric inputs lack `inputmode`, and sticky/fixed elements can obscure actions. |
| Motion | 3 / 10 | The reduced-motion token is a good baseline. A blocking protocol-themed preloader, perpetual market marquee, floating badges/spheres, and looping sample activity add motion without proving transaction state. |

### Critical Findings

1. **Transaction direction and quote math are not trustworthy.** In `public/index.html`, the sell toggle changes the copy, but `updateTerminalCalculation()` continues using the same GHS-to-USD-to-crypto calculation and the output remains crypto-denominated. BTC and ETH are hard-coded at `$68,000` and `$3,500`, while the live market table displayed BTC near `$76,000`. The trade page also renders `LIVE EXCHANGE RATE` while showing `Rates temporarily unavailable.`

   Before: sell mode says “You Send Crypto Value” but retains the GHS input and computes a crypto quantity.

   After: buy must be GHS → crypto; sell must be crypto → GHS. Both directions should use the same validated quote source as the table and server-side order calculation. When rates are unavailable or stale, show that state and prevent proceeding with an unverified quote.

2. **The mobile ticker obscures a primary control.** A cache-busted 390px browser check measured the ticker at `y=816..844` and the sell toggle through approximately `y=848`; hit-testing at the button center returned `.ticker-tape__item`. Legacy `.ticker-tape { display: block !important; position: fixed !important; z-index: 1000 }` rules override the later attempt to hide it on small screens.

   Before: fixed bottom market tape remains above the page content on mobile.

   After: remove it on compact screens, or reserve enough safe-area space and verify no control can sit behind it. Prefer one deliberate market display over a continuous ticker on the trade-critical viewport.

3. **Live-looking activity and operational claims still need evidence.** The homepage now discloses that the trade stream is illustrative, but it still repeats the same examples with “4s ago” through “54s ago” timestamps. Homepage volume, payout-time, and SLA claims also need source/owner verification before they serve as trust proof.

   Before: repeated sample trades with relative timestamps and prominent settlement metrics.

   After: use privacy-safe, real events with truthful timestamps and documented definitions, or remove relative times and keep any sample content unmistakably static. Publish only metrics that can be substantiated.

### High-Value Improvements

1. **Make transaction states operational.** Keep the order progress display tied to persisted status, and add real event timestamps only when the backend stores them. The current database/order response supports current status and created/updated dates, not a full sequence of verified milestones. Add the event log before promising “payment detected” or “payout sent.”

2. **Unify the visual system.** The homepage, customer portal, multi-step order pages, and admin portal use shared tokens but also substantial inline styles and page-specific overrides. Consolidate typography, spacing, control height, surface, focus, and status tokens; remove contradictory `!important` rules and repeated navigation markup incrementally.

3. **Raise form and status quality.** Associate every visible label with its control, use `inputmode="decimal"` for amounts, provide field-level errors and explicit loading/success/failure states, and keep the final fee, rate timestamp, and receive amount visible before submission.

4. **Reduce motion to purposeful feedback.** Remove the fake protocol progress sequence or make it a short, truthful loading state. Keep motion for quote changes, drawer movement, and confirmed order-state transitions; pause marquees and decorative movement when they are not conveying useful data.

### Verification and Limits

- Browser checked homepage layout at 1440, 1024, 768, and 390px; no horizontal overflow was measured.
- At 390px, the homepage ticker overlaps the sell toggle despite the no-overflow result.
- Trade asset menu keyboard selection updated the selected asset/form value and Escape closed the menu.
- Desktop homepage screenshot showed the hero, quote widget, market table, metrics, and live-looking tickers competing in the first viewport.
- The order-summary page requires session/order state; its direct preview opened an expired-session/missing-details alert.
- Admin pages require an authenticated admin session. Only the admin login entry and source/styles were reviewable here, not the protected dashboard screens.
- `npm test` is not a usable test suite in this repo; `package.json` currently defines it as a placeholder that exits with “no test specified.”

### Skill Applicability

- Applied the UI skill’s seven-category audit format and UI/UX Pro Max’s fintech, responsive, form, accessibility, dropdown, and motion checks.
- Reviewed `ui-material`, but the repository does not declare Material 3 and the user did not request an M3 conversion; an M3 compliance score would be misleading.
- Reviewed `ui-styling`; its shadcn/Tailwind implementation guidance does not directly apply because this project is vanilla HTML/CSS/JavaScript with no Tailwind or shadcn dependency.