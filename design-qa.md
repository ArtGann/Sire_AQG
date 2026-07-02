# Design QA

Source visual: `C:\Users\sofiv\OneDrive\Рабочий стол\Сайт в аренду\f8d8e298598d5a0688867473a3e29783_6cf261db-7c7b-4c62-a613-e2899472c1f3.png`

Prototype capture: `design-check-final.png`

Viewport checked: 1440px desktop.

Result: passed.

Notes:
- Hero background was replaced with a new higher-quality generated photo asset matched to the original screenshot composition: `assets/img/hero-bg-source-match.jpg`.
- Montserrat is now loaded locally and used across the page.
- Hero text, form placement, header spacing, and primary card rhythm were adjusted closer to the source.
- Icons were replaced with the provided PNG icon set from `иконки`. Source images were processed into transparent, optimized 512px PNGs under `assets/img/icons/provided/` and mapped onto the matching site concepts: family owned, premium materials, craftsmanship, weather, completed projects, warranty, licensed, insured, services, `How It Works`, and trust cards.
- `Our Gutter Services` card photos were replaced with new generated, service-specific photo assets: `assets/img/service-1-generated.jpg` through `assets/img/service-6-generated.jpg`.
- `Recent Projects` now uses generated before/after pairs: `assets/img/project-1-before-generated.jpg` through `assets/img/project-4-after-generated.jpg`; split view shows before on the left and after on the right, with click states cycling split -> before -> after.
- Philadelphia project images were revised again with sharp wide downspout-focused crops: `assets/img/project-4-before-downspout-wide.jpg` and `assets/img/project-4-after-downspout-wide.jpg`.
- Reviews, service area, and footer were visually polished: Google wordmark/G icons and Google-yellow rating stars were rebuilt, the second review now shows 4.5 stars, service-area checkmarks use the button green, the map was replaced with a labeled PA/NJ coverage SVG, footer social/contact icons were refreshed, and footer credential badge PNGs were recreated at higher quality.
- Footer credential badges were restyled to match the supplied references: a light `Licensed PA & NJ` stamp plus dark `Fully Insured` and `50-Year Warranty` shield badges.
- `How It Works` was rebuilt visually with circular icon nodes, numbered badges, and dotted connectors.
- Footer `Licensed & Insured` badges were replaced with crisp text-based badge artwork for better fidelity and legibility.

Remaining polish:
- Logo artwork is reconstructed from the available AQG mark plus live text because the original exact logo asset was not present in the project archive.

## FAQ Reference Match QA — 2026-06-30

- Source visual truth: `design-qa-assets/faq-reference.png`
- Implementation screenshot: `design-qa-assets/faq-implementation-1664x907.png`
- Side-by-side comparison: `design-qa-assets/faq-side-by-side.png`
- Responsive evidence: `design-qa-assets/faq-mobile-390x844.png`
- Viewport: 1664 × 907 desktop; 390 × 844 mobile
- State: first FAQ card open; remaining cards closed
- Full-view comparison evidence: the side-by-side image compares the entire scoped FAQ component at the source viewport.
- Focused region comparison evidence: the FAQ component is the complete requested scope, so the same full-resolution side-by-side also serves as the focused comparison; typography, cards, icons, CTA, trust row, and background wave remain clearly readable.

**Findings**

- No actionable P0/P1/P2 differences remain.
- Fonts and typography: Montserrat family, display hierarchy, question weights, wrapping, and answer leading closely match the reference.
- Spacing and layout rhythm: 34/66 two-column composition, 120px first-card offset, 254px open card, 118px closed cards, 29px gaps, radii, and elevation match the source proportions.
- Colors and visual tokens: warm white surface, AQG green accents, pale icon wells, fine borders, and low-contrast sage wave align with the reference.
- Image quality and asset fidelity: the lower wave is a generated raster asset based on the reference; UI and trust icons are local Bootstrap Icons SVG assets rather than CSS-drawn approximations.
- Copy and content: headings, questions, answer copy, phone CTA, and trust labels match the supplied visual and existing business data.
- Interaction and accessibility: native `details` controls expand correctly, plus/minus and chevron visuals switch with state, and the section has no horizontal overflow at desktop or mobile sizes.

**Patches Made**

- Rebuilt the FAQ markup into the reference two-column layout.
- Added local phone, trust, chevron, plus, and minus icon assets.
- Added a generated 5 KB WebP wave background and responsive sizing.
- Tuned desktop and mobile typography, card heights, gaps, and state styling from measured captures.

**Follow-up Polish**

- The browser scrollbar visible in the implementation evidence is browser chrome and not part of the component.

final result: passed
