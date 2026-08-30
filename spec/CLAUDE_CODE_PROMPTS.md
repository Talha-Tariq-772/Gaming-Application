# Claude Code prompts — Nova redesign

Run these in order, one session each. Commit after every session. Do not batch them — a redesign that touches tokens, layout and WebGL in one pass is very hard to bisect when something breaks.

---

## Before you start — two things that will bite

**Your tests will break.** You have 114+ passing tests and a 22/22 Playwright walkthrough. Any test that selects by Tailwind class, DOM structure, or visible text will fail once the markup changes. Plan for a test-repair pass; don't let a red suite sit for six sessions or you'll stop trusting it.

**Freeze checkout and admin.** Those routes work and handle real money. They get the palette in the final session and nothing else — no motion, no canvas, no clip-paths.

---

## Session 0 — branch and audit

```
Create a branch `feat/nova-redesign`.

Then audit the current UI layer and report back before changing anything:
1. List every file that imports from `three`, `@react-three/fiber`, `@react-three/drei`, `gsap`, or `lenis`, with what each one renders.
2. Report the current gzipped size of the largest client bundles (`.next/analyze` or `next build` output).
3. List every Tailwind colour class currently used across `app/` and `components/` and how often — I want to know how much surface area a token swap touches.
4. List every Playwright selector in `e2e/` that depends on a CSS class or DOM structure rather than a `data-testid`.

Do not modify any files. Report only.
```

After this, ask it to add `data-testid` attributes to everything the Playwright suite selects structurally. That one change makes the whole redesign safe.

---

## Session 1 — colour tokens

```
Read spec/NOVA_DESIGN_SPEC.md section 1.

Add the `nova` colour palette to tailwind.config.ts under theme.extend.colors.

Then replace existing colour usage across app/ and components/ with the new tokens, mapping:
- any near-black / gray-900 / zinc-950 background -> nova.void
- section backgrounds -> nova.pitch
- card surfaces -> nova.crypt
- borders -> nova.hairline
- primary body text (white, gray-100, zinc-50) -> nova.bone
- secondary text -> nova.ash
- muted/disabled text -> nova.smoke
- primary CTA / active accent -> nova.ember

Rules:
- No text anywhere may be pure #FFFFFF.
- Do NOT touch app/checkout/** or app/admin/** in this session.
- Do not change any layout, spacing, or component structure. Colour only.

Run the test suite and report what broke.
```

---

## Session 2 — texture and typography

```
Read spec/NOVA_DESIGN_SPEC.md sections 2 and 3.

1. Generate a 128x128 tiling monochrome noise PNG at public/grain.png (write a small node script using sharp or pngjs to produce it — do not fetch one from the web). Keep it under 3kb.

2. In app/layout.tsx add a fixed, pointer-events-none overlay stack at z-50 containing the grain tile (opacity 0.035, mix-blend-overlay) and the radial vignette. It must sit above page content but below any modal portal — check what z-index the existing modals use and stay below it.

3. Load Cinzel (600, 700) and Barlow (400, 500) via next/font/google, latin subset only, and wire them as CSS variables --font-display and --font-ui in tailwind.config.ts.

4. Apply the type scale from section 3 to existing headings using clamp(). Do not restructure any markup.

Then report: the layout shift (CLS) before and after, and the added font payload in kb.
```

---

## Session 3 — primitives

```
Read spec/NOVA_DESIGN_SPEC.md sections 4 and 5.

Create components/ui/nova/ containing:
- Chamfer.tsx — wrapper applying the clip-path corner from section 4, with a `size` prop
- NovaButton.tsx — primary (ember fill) / ghost (hairline border) variants, chamfered, magnetic hover using GSAP quickTo, max 8px displacement
- NovaCard.tsx — crypt surface, hairline border igniting to ember/40 on hover, 0.6s expo-out
- Eyebrow.tsx — the uppercase 11px 0.18em-tracked micro-label
- FadeDivider.tsx — the gradient hairline rule
- Reveal.tsx — GSAP ScrollTrigger wrapper, y:40 -> 0, opacity fade, configurable stagger

Put the easing and duration constants from section 5 in lib/motion.ts and import them everywhere. No component may hardcode an easing curve.

Every component must respect prefers-reduced-motion by rendering the final state immediately with no animation. Add a unit test asserting this for each.
```

---

## Session 4 — the Nova hero

This is the showpiece session. Give it its own session and expect to iterate.

```
Read spec/NOVA_DESIGN_SPEC.md section 6 in full, and spec/hero-fog.frag.glsl.

Build components/hero/Nova/ as the new landing page hero. Architecture, exactly:

1. NovaHero.tsx — server component. Renders a static WebP poster as the LCP element (fills the viewport, object-cover) plus the headline markup. No client JS in the critical path.

2. NovaCanvas.tsx — 'use client', loaded via next/dynamic with ssr:false. Cross-fades in over 0.8s on first rendered frame, sitting above the poster.

3. Inside NovaCanvas:
   - A fullscreen triangle (NOT a quad — one less vertex and no diagonal seam) running hero-fog.frag.glsl.
   - Render to an offscreen target at 0.6x scale on desktop, 0.5x on mobile, upscaled to the canvas.
   - DPR capped at Math.min(devicePixelRatio, 1.5) desktop, 1.0 mobile.
   - Compile the shader with -DOCTAVES=5 on desktop, -DOCTAVES=3 on mobile. Two variants, no uniform branching.
   - An ember layer: THREE.Points, 1200 desktop / 400 mobile, additive blending, depthWrite false, positions animated entirely in the vertex shader from a uTime uniform. Zero per-frame JS on particle positions.
   - No EffectComposer. No post-processing passes. No GLTF, no external textures.

4. Detect device tier once on mount (devicePixelRatio, hardwareConcurrency, and a WebGL renderer string check) and pick the mobile/desktop config from that. Export it from lib/deviceTier.ts so other components can reuse it.

5. Stop the rAF loop entirely when the hero leaves the viewport (IntersectionObserver) and when document.hidden. Resume on re-entry.

6. If prefers-reduced-motion is set, or WebGL context creation fails, never load the canvas chunk at all — the poster stays.

7. Headline: Cinzel 700 uppercase, split to chars, revealed with 0.018s stagger on mount. Two NovaButtons below it.

Hold these budgets and report actuals against each:
- hero client chunk <= 120kb gzipped
- 60fps desktop, >= 45fps on 4x CPU throttle in devtools
- LCP <= 2.0s on Slow 4G throttling
- CLS 0

If any budget is missed, tell me which and what you'd cut. Do not quietly ship over budget.
```

---

## Session 5 — catalog and game detail

```
Restyle app/games and app/games/[slug] using the components/ui/nova primitives.

- Game cards: NovaCard, cover art with a CSS-only parallax on scroll and a subtle scale+brightness ignite on hover. No WebGL on this route.
- Staggered Reveal on the grid, 0.04s between cards, batched by row so a long catalog doesn't animate 200 items.
- Price and platform tags use Eyebrow styling.
- Game detail: full-bleed cover with vignette falloff into nova.void, Cinzel title overlapping the image bottom edge.

Virtualise the grid if the catalog can exceed 60 items — check the current query limit first and tell me what it is.

No layout or data-fetching changes. Presentation only.
```

---

## Session 6 — sweep and verify

```
1. Apply the nova palette only (no motion, no clip-paths) to app/checkout/**, app/admin/**, and the legal pages. Checkout keeps its current interaction model exactly — this route handles payment details and must not feel decorative.
2. Restyle /news, /community, /guides, /faq with the nova primitives.
3. Repair every test broken since session 0. Run the full suite plus the 22-step Playwright walkthrough and report.
4. Run Lighthouse on / and /games, mobile and desktop, and report all four scores against the pre-redesign baseline from session 0.
5. Re-check WCAG 2.1 AA contrast on every text/background pair in the new palette. nova.ash on nova.crypt is the pair most likely to fail — if it does, lighten ash rather than changing the surface.
```

---

## Sanity check at the end

If the site now looks expensive but `/checkout` feels slower or fussier than before, the redesign has failed at the only thing that actually earns money. Check that route on a real mid-range Android over mobile data before you call it done.
