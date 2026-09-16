# Landing page: 21st component sources

Retrieved through the authenticated 21st MCP on 2026-09-16, using two included component-code retrievals.

- [Text Reveal by ddoemonn](https://21st.dev/@ddoemonn/components/text-reveal), demo ID `23571` → `components/landing/TextReveal.tsx`. Adapted the word splitting, stagger timing, blur/slide reveal, in-view trigger and accessible text treatment. Content remains visible in server-rendered HTML, and reduced-motion preferences suppress the reveal.
- [Bento Card by 0xUrvish](https://21st.dev/@0xUrvish/components/bento-card), demo ID `10457`, informed the previous tabbed preview. That component has now been replaced by the shorter scroll-driven product story in `LandingMotion.tsx`; the unused implementation was removed.

The previews contain illustrative salon data. The booking demo creates no appointment; the WhatsApp FAQ accurately explains manual review and sending. Actual account access remains invite-only.

The landing uses self-hosted DM Sans exclusively, with upright typography and a minimum visible text size of 18px. The SIL Open Font License is included under `public/fonts/`.

## Liquid glass

[Simple Liquid Glass](https://github.com/lucaperullo/simple-liquid-glass) is pinned to `5.3.0`. Desktop screens wider than 1000px with a fine primary pointer retain glass on the two navbar pills, hero controls, two product previews, booking demo, FAQ, and closing action (12 optical surfaces). On smaller screens or touch-first devices, only the two floating navbar pills mount `LiquidGlass` instances; the remaining wrappers become ordinary CSS surfaces. Their renderers are unmounted, not merely hidden, and body surfaces use static styling.

The navbar has a subtle 3px blur on both layouts. Mobile explicitly uses the WebGL renderer through `LiquidGlassScene`, with the low quality preset, so Android and iOS both retain real refraction. Desktop retains automatic rendering and the standard quality preset. Unsupported rendering paths retain the library's fallback. The shared backdrop cache remains bounded to 32 MiB. Inactive content wrappers are included in the mobile navbar's captured backdrop, while active glass surfaces exclude themselves to prevent recursive capture.

The optical layer sits behind semantic controls so type and keyboard focus remain crisp. Navbar text and tint adapt to light content and the three dark image scenes. Reduced-transparency or increased-contrast preferences replace the optical layer with a solid surface. There is no continuous liquid animation.

The local DM Sans font is supplied as embedded CSS to the backdrop provider, avoiding a scan of the application's unrelated external icon-font stylesheet. Both navbar pills retain a subtle tint and blur; their controls are rendered above the optical layers.

## Chapter motion and navigation

`LandingMotion.tsx` uses native scroll progress: the hero frame recedes, the eight-word manifesto gains contrast, and three product scenes share one 285svh sticky sequence. Incoming scenes rise while the previous scene shrinks and dims. The booking demo remains outside that sequence. Widths below 1001px, viewports shorter than 680px, touch-first devices, and reduced-motion preferences use ordinary stacked scenes with complete content.

`LandingNav.tsx` separates the wordmark from the access actions. The desktop action pill contains Accedi and Prova la demo; mobile contains Accedi. The pills compact after 88px of scrolling and expand below 28px to prevent threshold jitter. Hover-capable pointers get rolling labels and a small arrow movement. Reduced motion disables these transitions.

The reference analysis and original adaptation are recorded in `capsules-design-study.md`.
