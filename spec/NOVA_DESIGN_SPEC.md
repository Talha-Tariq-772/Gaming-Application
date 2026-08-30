# Nova — design spec

Gothic / Diablo direction. Dark, warm, heavy texture. Heavy motion, fast on mid-range Android.

---

## 1. Colour tokens

The single most common mistake in a gothic palette is using a **cool** black and **pure white** text. Both read as generic dark-mode SaaS. Everything here is warm-shifted.

```ts
// tailwind.config.ts → theme.extend.colors
const nova = {
  void:    '#08060A',  // page background, warm-black
  pitch:   '#0D0A0C',  // section background
  crypt:   '#141013',  // card surface
  slab:    '#1E1719',  // raised surface / hover
  hairline:'#2A2124',  // borders

  ember:   '#C1440E',  // primary accent — CTA, active state
  emberLo: '#8B2F09',  // pressed / border
  blood:   '#7A1518',  // danger, sale tags
  gild:    '#C9A227',  // premium / rare tier only, use sparingly

  bone:    '#E8DFD0',  // primary text — NOT #FFFFFF
  ash:     '#9A8F84',  // secondary text
  smoke:   '#5C544E',  // muted / disabled
}
```

Rules:
- Body text is `bone`, never white. White on warm-black vibrates and looks cheap.
- `ember` is the only saturated colour in the general UI. `gild` appears on at most one element per viewport.
- Never put `ember` and `gild` adjacent — pick one per component.
- Success/error states: derive from `ember`/`blood` hue family, don't import a green/red from Tailwind defaults.

## 2. Texture layer

This is what separates it from a Tailwind template. Three global overlays, all CSS, all free:

1. **Grain** — a 128×128 tiling PNG of monochrome noise, `background-repeat`, `opacity: 0.035`, `mix-blend-mode: overlay`, `position: fixed; inset: 0; pointer-events: none; z-index: 50`. Generate once, ~2kb.
2. **Vignette** — `radial-gradient(ellipse at center, transparent 35%, #08060A 100%)`, fixed, `opacity: 0.7`. Gothic vignettes are strong; don't be shy.
3. **Scanline / weave** — optional `repeating-linear-gradient` 2px horizontal at `opacity: 0.02`.

Apply once in `app/layout.tsx` so every route inherits it.

## 3. Typography

| Role | Font | Spec |
|---|---|---|
| Display | Cinzel 700 | uppercase, `letter-spacing: 0.04em`, `clamp(2.75rem, 9vw, 8.5rem)`, `line-height: 0.92` |
| Section heading | Cinzel 600 | uppercase, `clamp(1.5rem, 3vw, 2.5rem)` |
| UI / body | Barlow 400/500 | `letter-spacing: 0.01em`, `line-height: 1.65` |
| Label / meta | Barlow 500 | uppercase, 11–12px, `letter-spacing: 0.18em` |

Load with `next/font/google` (self-hosted, zero layout shift). Subset to `latin` only. Do **not** use Cinzel Decorative or blackletter — unreadable at small sizes and reads as a 2009 WoW fansite.

The wide-tracked uppercase micro-label is doing a lot of work here. Use it on every eyebrow, price tag, and category chip.

## 4. Shape language

- No `rounded-lg`/`rounded-xl` anywhere. Rounded corners read SaaS.
- Cards and buttons use a chamfered corner via `clip-path`:
  ```css
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  ```
- Borders are 1px `hairline`, brightening to `ember` at 40% opacity on hover.
- Dividers: 1px line that fades at both ends — `linear-gradient(90deg, transparent, #2A2124, transparent)`.

## 5. Motion

Gothic motion is **heavy and slow**. Things move like stone, not like bubbles.

```ts
export const ease = {
  out:   [0.16, 1, 0.30, 1],    // expo-out, the workhorse
  inOut: [0.83, 0, 0.17, 1],
}
export const dur = { fast: 0.4, base: 0.8, slow: 1.2, epic: 1.8 }
```

- Nothing uses `linear` or Tailwind's default `ease`.
- Heading reveals: split to chars, `y: 40 → 0`, `opacity: 0 → 1`, stagger `0.018s`.
- Card hover: `scale(1.015)` over 0.6s + border ignite + cover-image displacement. No translate-y bounce.
- Page transitions: an ember-coloured curtain wipe, 0.6s out / 0.6s in.
- Buttons: magnetic pull, max 8px displacement, spring damping ~20.

## 6. Performance architecture — how "heavy" stays fast

This is the part that actually determines whether it ships. Non-negotiables:

**Resolution scaling.** The fog shader renders to an offscreen buffer at 0.6× (desktop) / 0.5× (mobile) and is upscaled. Fog is low-frequency so upscaling is invisible. This alone is a 3–4× cost reduction and is why "heavy fullscreen shader" is viable on a budget Android.

**DPR cap.** `Math.min(devicePixelRatio, 1.5)` desktop, `1.0` mobile. A 3× DPR phone rendering fullscreen fog at native res will drop to 20fps for no visual gain.

**One shader pass.** Fog, ember glow, vignette and grain are all computed in the same fragment shader. Do **not** use `EffectComposer` — each post pass is another fullscreen read/write.

**Octave count as a compile-time define.** 5 octaves desktop, 3 mobile, two compiled variants. Not a uniform branch.

**Embers as `THREE.Points`.** One draw call, additive blending, `depthWrite: false`. 1200 particles desktop / 400 mobile. Position updated in the vertex shader from a time uniform — never in JS per-frame.

**No GLTF. No models. No textures over 256px.** Total WebGL payload target: under 40kb.

**Kill the loop when off-screen.** `IntersectionObserver` on the hero → stop `requestAnimationFrame` entirely. Also stop on `document.hidden`. Biggest battery win available and most sites skip it.

**LCP is a static image.** Ship a 1600px WebP poster of the hero as the LCP element, render it immediately, dynamically `import()` the R3F bundle, cross-fade the canvas in over 0.8s once ready. Lighthouse sees the image, users see the fog. Keeps LCP under 2s on 4G.

**`prefers-reduced-motion`** → skip the canvas, keep the poster, disable GSAP reveals. One code path, tested.

**Budgets to hold yourself to:** hero JS ≤ 120kb gzipped after the dynamic chunk; 60fps desktop, ≥45fps on a Redmi-class device; LCP ≤ 2.0s on Slow 4G; CLS 0.

## 7. Where WebGL does NOT go

Only the hero gets a canvas. Everywhere else the "heavy" feel comes from CSS + GSAP, which costs nothing:

- Games catalog: CSS-only card ignite, staggered scroll reveal, parallax on cover art.
- Checkout: zero motion beyond 0.3s state transitions. People are entering payment details — flourish here reads as untrustworthy, and this is a storefront handling real money.
- Admin panel: no theme changes at all. It's a tool, keep it fast and legible.
