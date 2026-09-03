// WCAG 2.1 contrast audit for the nova palette — both themes. Computes real
// ratios (no eyeballing) for every text/background and UI-component/
// adjacent-surface pair actually used across the app — gathered by
// grepping every text-nova-*/bg-nova-*/border-nova-* combination in src/
// and app/. Flags anything under 4.5:1 (normal text), 3:1 (large text
// >=24px/19px-bold, or non-text UI components like borders/focus rings).
//
// Theme session: extended from a single (dark-only) PALETTE to DARK/LIGHT,
// matching app/globals.css's :root (dark, default) and `.light` (next-themes
// class-toggle target) blocks exactly. Also added two pair groups the
// original, dark-only version of this script never covered, both found to
// be real shipping failures while building the light palette:
//   - nova-ember-lo used as hover-state link/button TEXT (20+ call sites —
//     checkout, account, admin tables, FAQ, library) — was 2.10-2.41:1 in
//     dark mode alone, before light mode even entered the picture.
//   - the legacy --color-on-accent token as text on a nova-ember fill
//     (layout.tsx's skip-to-content link, and ::selection) — 3.78:1,
//     identical in both themes since neither token depends on the theme
//     class, but never checked by any prior version of this script.
// Re-run (`node audit/section7-contrast.mjs`) whenever a color pairing
// changes in either theme.

const DARK = {
  "nova-void": "#08060a",
  "nova-pitch": "#0d0a0c",
  "nova-crypt": "#141013",
  "nova-slab": "#1e1719",
  "nova-hairline": "#7e6954",
  "nova-ember": "#c1440e",
  "nova-ember-lo": "#fa7c29",
  "nova-ember-deep": "#612106",
  "nova-ember-text": "#db5d1f",
  "nova-ember-bright": "#e85d1f",
  "nova-ember-bright-hover": "#eb7541",
  "nova-blood": "#e0484d",
  "nova-gild": "#c9a227",
  "nova-bone": "#e8dfd0",
  "nova-ash": "#9a8f84",
  "nova-smoke": "#8d857c",
  "on-accent": "#faf8f5",
};

const LIGHT = {
  "nova-void": "#f5f1ea",
  "nova-pitch": "#eee7d9",
  "nova-crypt": "#e4dac6",
  "nova-slab": "#d6c9af",
  "nova-hairline": "#7d634a",
  "nova-ember": "#c1440e",
  "nova-ember-lo": "#6c2a09",
  "nova-ember-deep": "#612106",
  "nova-ember-text": "#8b380f",
  "nova-ember-bright": "#a83c0a",
  "nova-ember-bright-hover": "#8c3008",
  "nova-blood": "#a01c21",
  "nova-gild": "#624808",
  "nova-bone": "#29241f",
  "nova-ash": "#514436",
  "nova-smoke": "#605040",
  "on-accent": "#faf8f5",
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

/**
 * Every pair below: [context, fgToken, bgDescription, bgHex, kind]
 * kind: "text" -> needs 4.5:1 (3:1 if largeText:true), "ui" -> needs 3:1
 * (borders, focus rings, icon-only controls).
 */
function buildPairs(PALETTE) {
  const PAIRS = [];
  function hex(name) {
    const h = PALETTE[name];
    if (!h) throw new Error(`unknown token ${name}`);
    return h;
  }
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
  // ember-text: the text-only sibling of ember, used at 60+ call sites
  // (Eyebrow labels, nav/footer links, checkout steps).
  textPair("ember-text as small text on nova-void", "nova-ember-text", hex("nova-void"));
  textPair("ember-text as small text on nova-crypt", "nova-ember-text", hex("nova-crypt"));
  textPair("ember-text as small text on nova-slab", "nova-ember-text", hex("nova-slab"));
  // ember-lo: hover-state sibling of ember-text (`hover:text-nova-ember-lo`),
  // 20+ call sites — checkout, account, admin tables, FAQ, library.
  textPair("ember-lo (hover text) on nova-void", "nova-ember-lo", hex("nova-void"));
  textPair("ember-lo (hover text) on nova-crypt", "nova-ember-lo", hex("nova-crypt"));
  textPair("ember-lo (hover text) on nova-slab", "nova-ember-lo", hex("nova-slab"));

  // ---- Tinted badges: text-nova-X on bg-nova-X/alpha, composited over crypt
  // (StatusBadge, VariantsPanel gild pill, ChangeRoleDialog notice, blood
  // inline alerts — all render on nova-crypt panels) ----
  textPair("StatusBadge gild (pending/under_review) on crypt", "nova-gild", composite(hex("nova-gild"), 0.15, hex("nova-crypt")));
  textPair("StatusBadge approved (bone on ember/15) on crypt", "nova-bone", composite(hex("nova-ember"), 0.15, hex("nova-crypt")));
  textPair("StatusBadge rejected (bone on blood/15) on crypt", "nova-bone", composite(hex("nova-blood"), 0.15, hex("nova-crypt")));
  textPair("VariantsPanel estimate pill (gild/20) on crypt", "nova-gild", composite(hex("nova-gild"), 0.2, hex("nova-crypt")));
  textPair("ChangeRoleDialog notice (gild/10) on crypt", "nova-gild", composite(hex("nova-gild"), 0.1, hex("nova-crypt")));
  textPair("blood inline alerts (bone on blood/15) on crypt", "nova-bone", composite(hex("nova-blood"), 0.15, hex("nova-crypt")));
  textPair("StoreFilterBar active chip (void on ember-bright)", "nova-void", hex("nova-ember-bright"));

  // ---- Buttons (NovaButton + Button primary variant) — bright fill, dark
  // text: ember-lo/bone (dark fill, light text) passed contrast math but
  // read as dark and muddy as an actual CTA once shipped. ----
  textPair("Button/NovaButton primary (void on ember-bright)", "nova-void", hex("nova-ember-bright"));
  textPair("Button/NovaButton primary hover (void on ember-bright-hover)", "nova-void", hex("nova-ember-bright-hover"));
  textPair("Button ghost (ash on transparent = crypt)", "nova-ash", hex("nova-crypt"));
  textPair("NovaButton ghost (bone on transparent = void)", "nova-bone", hex("nova-void"));

  // ---- Admin nav active state (void on ember-bright, was bone-on-ember-lo) ----
  textPair("AdminNav active tab (void on ember-bright)", "nova-void", hex("nova-ember-bright"));
  textPair("AdminOrdersClient active filter (void on ember-bright)", "nova-void", hex("nova-ember-bright"));
  textPair("HeaderAuthMenu avatar initial (void on ember-bright)", "nova-void", hex("nova-ember-bright"));

  // ---- Legacy --color-on-accent, still live at two call sites: layout.tsx's
  // skip-to-content link (focus:bg-nova-ember focus:text-on-accent) and
  // ::selection (background: nova-ember, color: on-accent). Neither token
  // depends on the theme class, so this pair is identical in both themes —
  // included in both runs anyway so a future change to either value gets
  // re-checked automatically. ----
  textPair("skip-link / ::selection (on-accent on ember)", "on-accent", hex("nova-ember"));

  // ---- Focus ring / UI borders (3:1 floor, WCAG 1.4.11) ----
  for (const surface of ["nova-void", "nova-crypt", "nova-slab"]) {
    uiPair(`focus ring (ember) against ${surface}`, hex("nova-ember"), hex(surface));
    uiPair(`hairline border against ${surface}`, hex("nova-hairline"), hex(surface));
  }

  return PAIRS;
}

const LARGE_TEXT_MIN = 3.0;
const NORMAL_TEXT_MIN = 4.5;
const UI_MIN = 3.0;

function runTheme(label, palette) {
  const PAIRS = buildPairs(palette);
  let failures = 0;
  console.log(`\n=== ${label} theme ===`);
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
  return failures;
}

const darkFailures = runTheme("DARK", DARK);
const lightFailures = runTheme("LIGHT", LIGHT);

console.log(`\n${darkFailures + lightFailures} total failing pair(s) across both themes`);
process.exitCode = darkFailures + lightFailures > 0 ? 1 : 0;
