# Capsules reference study for PrenotaEasy

Reference: [Capsules by Moyra](https://capsules.moyra.co/), inspected on 16 September 2026 through live scrolling, screenshots, visible DOM geometry, and opening its menu, product details, and reservation drawer. This records the reference study and original design recommendations. The implementation notes below reflect the subsequent user-requested redesign.

## The direction

The intended PrenotaEasy experience should feel art directed: a memorable first scene, deliberately paced storytelling, and a convincing product demonstration. Rounding every existing card and adding more glass does not establish that rhythm. The previous interpretation put too much emphasis on surface treatment and too little on composition.

PrenotaEasy should express the relief of having an organised salon through scale, space, and a clear sequence of events. The story is: **your craft deserves your attention; booking and organisation can become simpler.**

## Section and transition map

The middle column records observed reference behavior. The final column is an original recommendation for PrenotaEasy, not a description of the reference.

| Reference section | Observed composition / transition | PrenotaEasy application |
| --- | --- | --- |
| Opening | Rounded image aperture expands; oversized identity arrives over photography. | Give the salon photograph a near-full-viewport frame. Keep “FAI SPAZIO. AL TALENTO.” as the visual anchor. A single short opening reveal should establish the scene without delaying access. |
| Welcome | Editorial text brightens progressively; small image capsules punctuate generous space. | A short manifesto about time and care, with one supporting salon detail. Move the current care message earlier, immediately after the hero, to connect the visual promise to the service. |
| Selection introduction | Huge heading precedes restrained copy and outlined tags. | Introduce the product with one decisive statement. Reduce the audience strip to a quiet supporting line instead of another row of glass containers. |
| Product gallery | A central image enlarges; stacked scenes rise while earlier scenes shrink. | Use one short visual sequence linking customer booking, the salon agenda, and the team. Show meaningful interface fragments, each with one large message. Avoid repeating this pattern elsewhere. |
| Product details | A rounded side panel opens over a dimmed scene. | Keep optional feature explanations lightweight. The existing interactive product tabs can provide detail without forcing visitors into another overlay. |
| Location | A quiet centered statement opens a map through a circular reveal. | Reinterpret the role as the link/QR connection between customer and salon. No geographical section is needed. Place a large QR artifact beside the booking demo. |
| Benefits | Gesture-driven pinned panels alternate text and imagery across two columns. | Pair one human salon image with a concise product benefit. Prefer normal vertical scrolling here because the product sequence already provides the major motion moment. |
| Activities | Vertical scrolling moves a wide horizontal image rail with parallax. | Omit this extra gallery in the first version. The current service does not need a second browsing catalog; it would delay the demo and repeat earlier benefits. |
| Feedback | Large single-quote presentation with portrait and directional controls. | Use this quiet reading rhythm for the existing practical FAQ. Add customer quotations only when real, approved material exists. |
| Closing | A second immersive image leads into an enormous moving CTA. | End with a closer salon detail and one oversized static invitation. Keep “Prova la demo” and “Accedi” easy to find, with the invite-only access condition readable. |
| Navigation / reservation | Persistent pill control expands into a menu; reservation uses a side drawer. | Use a compact liquid-glass navigation capsule with generous targets. Keep the live booking simulation in the page and the actual login route intact. |

The gallery followed scroll distance. In the benefits sequence, scroll position stayed fixed while successive gestures advanced panels. These are distinct interaction models. The testimonial layout was inspected, but its precise text-change choreography was not reliably verified. Narrow-screen checks were limited to gallery and menu behavior; this was not a full mobile accessibility audit.

## A shorter, original page structure

1. **The emotional promise.** One immersive salon scene, huge upright headline, brief explanation, and a direct demo action. Visitors should understand that this is booking software for their salon before they scroll.
2. **The reason to care.** A concise manifesto: give your attention to clients and your craft. This replaces some of the repeated benefit copy currently spread across the audience strip, feature introduction, and care section.
3. **The product story.** Three connected moments: a client chooses a service; the appointment appears in an organised agenda; the right collaborator knows what comes next. These are illustrative scenes, clearly distinguished from the working demo.
4. **Try the experience.** The existing three-step booking simulation, with its selection, date/time, and confirmation states, plus the QR/link explanation. This section should work at the visitor’s pace.
5. **Practical confidence.** Short feature details and the existing FAQ. Preserve the honest WhatsApp explanation: the message is prepared for the user to review and send.
6. **The invitation.** A distinctive final image and large CTA. Retain login, privacy, and the actual activation conditions.

This structure combines several reference roles into six PrenotaEasy chapters. It intentionally has its own content order and interaction density.

## Transition storyboard for PrenotaEasy

These are proposed starting values, not measurements of Moyra’s implementation. Tune against actual devices and real content height.

| Transition | Proposed movement | Purpose and limit |
| --- | --- | --- |
| Initial paint → hero | Content is readable immediately; image eases from roughly 1.04 to 1 over 650–850 ms. | Establish depth without a blocking loader or a blank opening. Avoid animating every letter independently. |
| Hero → manifesto | Over about half a viewport, the image frame gains a little inset and roundness as the text exits naturally. | Make the opening feel like a scene giving way to the next chapter. Keep wheel and touch behavior native. |
| Manifesto reading | Words move from muted-but-readable to full contrast once, over a short scroll range. | Emphasise the central promise. Provide a fully readable static version for reduced motion and initial HTML. |
| Product entry | A compact agenda preview grows into a large rounded scene. | Direct attention from the promise to the product. Keep interface text at a readable final scale. |
| Product scene 1 → 2 → 3 | Incoming scene moves upward; previous scene recedes to about 0.95 scale and dims slightly. | Explain cause and effect. Use one desktop sticky sequence around 220–260 svh total, subject to viewport height; no wheel interception. |
| Product → demo | Release the sticky scene and return to normal document flow. | A visible change of pace invites interaction. No moving parent around active form controls. |
| FAQ → final invitation | A single image reveal and quiet heading entrance. | Restore emotional emphasis without starting another long motion sequence. |
| Menu open / close | Glass capsule expands from its existing position, approximately 240–320 ms. | Maintain spatial continuity. Support keyboard focus, Escape, and a clear close action. |

On phones and short screens, replace the pinned product sequence with ordinary stacked scenes. Do not shrink an entire desktop layout to fit. Keep the demo stable while a visitor selects services or times. Reduced motion should show complete content with no pinned choreography or required animation.

## Glass, type, and shape

**Glass should have a job.** Keep simple-liquid-glass on the floating navigation and a small number of scene controls. Use transparent tint, a crisp edge, and visible refraction against real imagery. Keep body copy and product information on calm surfaces. Removing the full-panel wrappers from FAQ rows and long text blocks would restore visual hierarchy and reduce competing reflections.

**Oversized type remains a requirement.** Use the existing upright DM Sans. Start around 110–180 px for the desktop hero, 64–112 px for major headings, 24–32 px for explanatory copy, and at least 18 px for labels. On phones, reflow headline lines deliberately around 48–72 px, with supporting copy around 20–24 px. Adjust for actual available width rather than forcing a single line. No cursive or italic accent font.

**Define shape by role.** Main image scenes can use generous 48–80 px desktop corners, with smaller values on narrow screens. Navigation and compact buttons can be true pills. Functional product panels need enough internal space to remain readable; they should not all inherit the same capsule silhouette.

**Retain PrenotaEasy’s identity.** Build around salon photography, warm cream, deep plum, and the existing brand. Do not reuse the reference’s photography, logo treatment, copy, destinations, or full sequence of page sections. The transferable ideas are pacing, framing, and continuity.

## Implementation implications in this repository

- `LandingPage.tsx`: restructure the narrative and remove repeated feature explanations; preserve demo state and real navigation destinations.
- `LandingMotion.tsx`: own the short scene sequence and its static fallback. Use the existing Motion dependency where it fits; no additional animation framework is required for this proposed scope.
- `ProductShowcase.tsx`: retain the accessible interactive tabs for deeper exploration. Avoid mounting multiple working copies of the same control inside animated scenes.
- `LandingGlass.tsx`: keep optical effects separate from text and focus rings; check header contrast over every light and dark chapter. Validate the captured backdrop path on supported non-native rendering devices before declaring cross-browser parity.
- `app/landing.css`: replace accumulated broad capsule overrides with a deliberate scene, surface, and control hierarchy. Keep the user-requested progress bar removed.

The existing broad glass iteration should not be treated as the final interpretation of this reference. The next implementation should begin with the hero-to-manifesto transition and one product sequence, then build the remaining page around that established rhythm.

Acceptance checks: readable initial render, keyboard navigation, working demo completion and reset, functional QR target, no accidental real booking or message, no horizontal overflow, minimum label size, reduced-motion fallback, and real-device glass rendering/contrast checks where available.

## Implemented adaptation — 16 September 2026

The page now follows the shorter six-chapter structure. The product sequence combines booking, agenda/team, and the human benefit of more time for clients. It uses a 285svh native-scroll sequence on sufficiently large desktop viewports. The former tabbed showcase and repeated feature copy were removed to keep the story concise. The functional demo stays in normal flow.

The user refined the navigation to two separate glass pills: wordmark and access actions. Both compact on scroll; desktop shows login plus demo, while mobile shows login. There is no expanding menu or drawer. The later explicit glass preference supersedes the earlier recommendation: retain rich desktop glass, but mount it only on the two navbar pills on mobile.

The image hero recedes into the manifesto; the first product capsule expands, then later scenes rise as earlier scenes recede. The closing image is a static frame with a brief heading reveal. No wheel interception, horizontal gallery, progress bar, or reference content is included. Mobile, short screens and reduced-motion layouts display ordinary stacked product scenes.
