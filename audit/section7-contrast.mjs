// WCAG 2.1 contrast audit for the nova palette. Computes real ratios (no
// eyeballing) for every text/background and UI-component/adjacent-surface
// pair actually used across the app — gathered by grepping every
// text-nova-*/bg-nova-*/border-nova-* combination in src/ and app/. Flags
// anything under 4.5:1 (normal text), 3:1 (large text >=24px/19px-bold, or
// non-text UI components like borders/focus rings).
//
// No prior WCAG audit script existed in this repo despite "Session 6 WCAG
// audit" comments referencing one — this is a new one, written to be
// re-run (`node audit/section7-contrast.mjs`) whenever a color pairing
// changes, rather than re-eyeballing it each time.

const PALETTE = {
  "nova-void": "#08060a",
  "nova-pitch": "#0d0a0c",
  "nova-crypt": "#141013",
  "nova-slab": "#1e1719",
  "nova-hairline": "#2a2124",
  "nova-ember": "#c1440e",
  "nova-ember-lo": "#8b2f09",
  "nova-ember-deep": "#612106",
  "nova-ember-text": "#db5d1f",
  "nova-blood": "#e0484d",
  "nova-gild": "#c9a227",
  "nova-bone": "#e8dfd0",
  "nova-ash": "#9a8f84",
  "nova-smoke": "#8d857c",
};

function hexToRgb(hex) {
  const m = hex.replace("#", "").match(/\w\w/g).map((x) => parseInt(x, 16));
  return { r: m[0], g: m[1], b: m[2] };
}

function relLuminance({ r, g, b }) {
  const c = [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(hexA, hexB) {
  const l1 = relLuminance(hexToRgb(hexA));
  const l2 = relLuminance(hexToRgb(hexB));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite a foreground color at `alpha` over an opaque backdrop. */
function composite(fgHex, alpha, backdropHex) {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(backdropHex);
  const mix = (a, b) => Math.round(a * alpha + b * (1 - alpha));
  const r = mix(fg.r, bg.r).toString(16).padStart(2, "0");
  const g = mix(fg.g, bg.g).toString(16).padStart(2, "0");
  const b = mix(fg.b, bg.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function hex(name) {
  const h = PALETTE[name];
  if (!h) throw new Error(`unknown token ${name}`);
  return h;
}

/**
 * Every pair below: [context, fgToken, bgDescription, bgHex, kind]
 * kind: "text" -> needs 4.5:1 (3:1 if largeText:true), "ui" -> needs 3:1
 * (borders, focus rings, icon-only controls).
 */
const PAIRS = [];
function textPair(context, fgToken, bgHex, opts = {}) {
  PAIRS.push({ context, fg: hex(fgToken), bg: bgHex, kind: "text", ...opts });
}
function uiPair(context, fgHex, bgHex) {
  PAIRS.push({ context, fg: fgHex, bg: bgHex, kind: "ui" });
}

// ---- Baseline body/heading text on every surface it actually appears on ----
for (const surface of ["nova-void", "nova-crypt", "nova-slab"]) {
  textPair(`body text on ${surface}`, "nova-bone", hex(surface));
  textPair(`secondary text (ash) on ${surface}`, "nova-ash", hex(surface));
  textPair(`tertiary text (smoke) on ${surface}`, "nova-smoke", hex(surface));
}

// ---- Status/semantic text, plain (no bg class -> inherits page surface) ----
for (const surface of ["nova-void", "nova-crypt"]) {
  textPair(`blood error text on ${surface}`, "nova-blood", hex(surface));
  textPair(`gild warning/highlight text on ${surface}`, "nova-gild", hex(surface));
}
// FIXED: plain nova-ember as small/normal text topped out at 3.94:1 (on
// void, the lightest-possible ceiling for ember-as-text) and 3.68:1 on
// crypt — under the 4.5:1 text floor at every surface in the palette, no
// exceptions. Rather than re-theme the 60+ call sites (Eyebrow labels,
// nav/footer links, checkout steps) that used bare `nova-ember` for text,
// added a text-only sibling token (nova-ember-text, #db5d1f) and pointed
// those call sites at it — nova-ember itself is untouched for fills,
// borders, focus rings, and gradient stops.
textPair("ember-text as small text on nova-void", "nova-ember-text", hex("nova-void"));
textPair("ember-text as small text on nova-crypt", "nova-ember-text", hex("nova-crypt"));
textPair("ember-text as small text on nova-slab", "nova-ember-text", hex("nova-slab"));

// ---- Tinted badges: text-nova-X on bg-nova-X/alpha, composited over crypt
// (StatusBadge, VariantsPanel gild pill, ChangeRoleDialog notice, blood
// inline alerts — all render on nova-crypt panels) ----
textPair("StatusBadge gild (pending/under_review) on crypt", "nova-gild", composite(hex("nova-gild"), 0.15, hex("nova-crypt")));
textPair("StatusBadge approved FIXED (bone on ember/15) on crypt", "nova-bone", composite(hex("nova-ember"), 0.15, hex("nova-crypt")));
textPair("StatusBadge rejected FIXED (bone on blood/15) on crypt", "nova-bone", composite(hex("nova-blood"), 0.15, hex("nova-crypt")));
textPair("VariantsPanel estimate pill (gild/20) on crypt", "nova-gild", composite(hex("nova-gild"), 0.2, hex("nova-crypt")));
textPair("ChangeRoleDialog notice (gild/10) on crypt", "nova-gild", composite(hex("nova-gild"), 0.1, hex("nova-crypt")));
textPair("blood inline alerts FIXED (bone on blood/15) on crypt", "nova-bone", composite(hex("nova-blood"), 0.15, hex("nova-crypt")));
textPair("StoreFilterBar active chip FIXED (bone on ember-lo)", "nova-bone", hex("nova-ember-lo"));

// ---- Buttons (NovaButton + Button primary variant) ----
textPair("Button/NovaButton primary FIXED (bone on ember-lo)", "nova-bone", hex("nova-ember-lo"));
textPair("Button/NovaButton primary hover FIXED (bone on ember-deep)", "nova-bone", hex("nova-ember-deep"));
textPair("Button ghost (ash on transparent = crypt)", "nova-ash", hex("nova-crypt"));
textPair("NovaButton ghost (bone on transparent = void)", "nova-bone", hex("nova-void"));

// ---- Admin nav active state (FIXED: bone on ember-lo, was ember-on-ember-lo) ----
textPair("AdminNav active tab FIXED (bone on ember-lo)", "nova-bone", hex("nova-ember-lo"));
textPair("AdminOrdersClient active filter FIXED (bone on ember-lo)", "nova-bone", hex("nova-ember-lo"));
textPair("HeaderAuthMenu avatar initial FIXED (bone on ember-lo)", "nova-bone", hex("nova-ember-lo"));

// ---- Focus ring / UI borders (3:1 floor, WCAG 1.4.11) ----
for (const surface of ["nova-void", "nova-crypt", "nova-slab"]) {
  uiPair(`focus ring (ember) against ${surface}`, hex("nova-ember"), hex(surface));
  uiPair(`hairline border against ${surface}`, hex("nova-hairline"), hex(surface));
}

// ---- Run ----
const LARGE_TEXT_MIN = 3.0;
const NORMAL_TEXT_MIN = 4.5;
const UI_MIN = 3.0;

let failures = 0;
console.log("context".padEnd(58), "ratio".padStart(7), "min", "result");
console.log("-".repeat(80));
for (const p of PAIRS) {
  const r = ratio(p.fg, p.bg);
  const min = p.kind === "ui" ? UI_MIN : p.largeText ? LARGE_TEXT_MIN : NORMAL_TEXT_MIN;
  const pass = r >= min;
  if (!pass) failures++;
  console.log(
    p.context.padEnd(58),
    r.toFixed(2).padStart(7),
    String(min).padStart(3),
    pass ? "PASS" : "FAIL",
  );
}
console.log("-".repeat(80));
console.log(`${failures} failing pair(s) out of ${PAIRS.length}`);
process.exitCode = failures > 0 ? 1 : 0;
