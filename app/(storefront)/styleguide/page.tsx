import type { Metadata } from "next";
import Button from "@/components/Button";

export const metadata: Metadata = {
  title: "Styleguide",
  alternates: {
    canonical: "/styleguide",
  },
};

const COLOR_GROUPS: {
  heading: string;
  swatches: { name: string; varName: string; hex: string }[];
}[] = [
  {
    heading: "Surfaces",
    swatches: [
      { name: "Background", varName: "--color-bg", hex: "#08080A" },
      { name: "Surface 1", varName: "--color-surface-1", hex: "#131316" },
      { name: "Surface 2", varName: "--color-surface-2", hex: "#1C1C21" },
      { name: "Surface 3", varName: "--color-surface-3", hex: "#26262C" },
      { name: "Border", varName: "--color-border", hex: "#2F2F36" },
      { name: "Border Strong", varName: "--color-border-strong", hex: "#3D3D45" },
    ],
  },
  {
    heading: "Text",
    swatches: [
      { name: "Text", varName: "--color-text", hex: "#F5F5F7" },
      { name: "Text Muted", varName: "--color-text-muted", hex: "#8B8B95" },
      { name: "Text Faint", varName: "--color-text-faint", hex: "#5A5A63" },
    ],
  },
  {
    heading: "Accent",
    swatches: [
      { name: "Accent", varName: "--color-accent", hex: "#00E6D8" },
      { name: "Accent Strong", varName: "--color-accent-strong", hex: "#4DFFF2" },
      { name: "Accent Dim", varName: "--color-accent-dim", hex: "#0A3D3A" },
      { name: "On Accent", varName: "--color-on-accent", hex: "#04100F" },
    ],
  },
];

const TYPE_SCALE = [
  { token: "--text-xs", className: "text-xs", label: "XS · captions" },
  { token: "--text-sm", className: "text-sm", label: "SM · secondary UI" },
  { token: "--text-base", className: "text-base", label: "Base · body copy" },
  { token: "--text-lg", className: "text-lg", label: "LG · lead paragraphs" },
  { token: "--text-xl", className: "text-xl", label: "XL · card titles" },
  { token: "--text-2xl", className: "text-2xl", label: "2XL · section titles" },
  { token: "--text-3xl", className: "text-3xl", label: "3XL · subheads" },
  { token: "--text-display-sm", className: "text-display-sm", label: "Display SM" },
  { token: "--text-display-md", className: "text-display-md", label: "Display MD" },
  { token: "--text-display-lg", className: "text-display-lg", label: "Display LG" },
];

const SPACING_SCALE = [
  { token: "--space-3xs", px: "4px" },
  { token: "--space-2xs", px: "8px" },
  { token: "--space-xs", px: "12px" },
  { token: "--space-sm", px: "16px" },
  { token: "--space-md", px: "24px" },
  { token: "--space-lg", px: "32px" },
  { token: "--space-xl", px: "48px" },
  { token: "--space-2xl", px: "64px" },
  { token: "--space-3xl", px: "96px" },
  { token: "--space-4xl", px: "128px" },
  { token: "--space-5xl", px: "192px" },
];

const RADII = [
  { token: "--radius-sm", className: "rounded-sm", label: "SM · 6px" },
  { token: "--radius-md", className: "rounded-md", label: "MD · 10px" },
  { token: "--radius-lg", className: "rounded-lg", label: "LG · 16px" },
  { token: "--radius-full", className: "rounded-full", label: "Full · pill" },
];

const SHADOWS = [
  { token: "--shadow-sm", className: "shadow-sm", label: "SM" },
  { token: "--shadow-md", className: "shadow-md", label: "MD" },
  { token: "--shadow-lg", className: "shadow-lg", label: "LG" },
  { token: "--shadow-glow", className: "shadow-glow", label: "Glow (accent)" },
];

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-nova-hairline py-24 first:border-t-0 first:pt-0">
      <div className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember">
          {eyebrow}
        </span>
        <h2 className="mt-2 text-2xl font-display font-bold text-nova-bone">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <div className="mx-auto max-w-page px-4 py-24 md:px-8">
      <header className="mb-24">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember">
          Reference
        </span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">
          Styleguide
        </h1>
        <p className="mt-4 max-w-lg text-lg text-nova-ash">
          Every color, size, and interaction token that makes up the Nova
          design system.
        </p>
      </header>

      {/* Colors */}
      <Section eyebrow="Foundations" title="Color">
        <div className="flex flex-col gap-12">
          {COLOR_GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.08em] text-nova-smoke">
                {group.heading}
              </h3>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
                {group.swatches.map((s) => (
                  <div key={s.varName} className="flex flex-col gap-2">
                    <div
                      className="h-20 rounded-md border border-nova-hairline"
                      style={{ background: `var(${s.varName})` }}
                    />
                    <span className="text-sm text-nova-bone">{s.name}</span>
                    <span className="font-mono text-xs text-nova-smoke">
                      {s.varName}
                    </span>
                    <span className="font-mono text-xs text-nova-smoke">
                      {s.hex}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section eyebrow="Foundations" title="Typography">
        <div className="flex flex-col gap-8">
          {TYPE_SCALE.map((t) => (
            <div
              key={t.token}
              className="flex flex-col gap-2 border-b border-nova-hairline pb-8 last:border-b-0"
            >
              <span className="font-mono text-xs text-nova-smoke">
                {t.token} · {t.label}
              </span>
              <span
                className={`${t.className} font-display font-bold text-nova-bone`}
              >
                Play what&rsquo;s next
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Spacing */}
      <Section eyebrow="Foundations" title="Spacing">
        {/* The bars below show literal token widths (up to 192px) — on
            narrow viewports that's wider than the content column, so this
            row scrolls within itself rather than pushing the whole page. */}
        <div className="flex flex-col gap-4 overflow-x-auto">
          {SPACING_SCALE.map((s) => (
            <div key={s.token} className="flex w-fit items-center gap-6">
              <span className="w-32 shrink-0 font-mono text-xs text-nova-smoke">
                {s.token}
              </span>
              <div
                className="h-3 shrink-0 rounded-sm bg-nova-ember"
                style={{ width: `var(${s.token})` }}
              />
              <span className="shrink-0 font-mono text-xs text-nova-smoke">
                {s.px}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Radius */}
      <Section eyebrow="Foundations" title="Radius">
        <div className="flex flex-wrap gap-8">
          {RADII.map((r) => (
            <div key={r.token} className="flex flex-col items-center gap-2">
              <div
                className={`h-20 w-20 border border-nova-hairline bg-nova-slab ${r.className}`}
              />
              <span className="font-mono text-xs text-nova-smoke">
                {r.label}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Shadows */}
      <Section eyebrow="Foundations" title="Elevation">
        <div className="flex flex-wrap gap-8">
          {SHADOWS.map((s) => (
            <div key={s.token} className="flex flex-col items-center gap-4">
              <div
                className={`h-20 w-32 rounded-md bg-nova-slab ${s.className}`}
              />
              <span className="font-mono text-xs text-nova-smoke">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Motion */}
      <Section eyebrow="Foundations" title="Motion">
        <p className="mb-8 max-w-lg text-sm text-nova-ash">
          One easing curve, three durations. Hover each block to compare
          timing.
        </p>
        <div className="flex flex-wrap gap-8">
          {[
            { label: "Fast · 150ms", duration: "var(--duration-fast)" },
            { label: "Base · 300ms", duration: "var(--duration-base)" },
            { label: "Slow · 600ms", duration: "var(--duration-slow)" },
          ].map((m) => (
            <div
              key={m.label}
              className="group flex h-20 w-32 items-center justify-center rounded-md border border-nova-hairline bg-nova-slab"
            >
              <div
                className="h-8 w-8 rounded-full bg-nova-ember transition-transform ease-standard group-hover:scale-150"
                style={{ transitionDuration: m.duration }}
              />
              <span className="sr-only">{m.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Buttons */}
      <Section eyebrow="Components" title="Buttons">
        <p className="mb-8 max-w-lg text-sm text-nova-ash">
          Hover, focus, or tab to preview interactive states. Disabled
          examples are shown statically.
        </p>
        <div className="flex flex-col gap-12">
          {(["primary", "secondary", "ghost"] as const).map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-6">
              <span className="w-24 shrink-0 text-sm capitalize text-nova-smoke">
                {variant}
              </span>
              <Button variant={variant}>Play Now</Button>
              <Button variant={variant} disabled>
                Play Now
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {/* Cards */}
      <Section eyebrow="Components" title="Cards">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-8">
            <h3 className="text-xl font-display font-bold text-nova-bone">
              Default
            </h3>
            <p className="mt-2 text-sm text-nova-ash">
              Surface 1, subtle border. Used for standard content blocks.
            </p>
          </div>

          <div className="rounded-lg border border-nova-hairline bg-nova-slab p-8 shadow-md">
            <h3 className="text-xl font-display font-bold text-nova-bone">
              Elevated
            </h3>
            <p className="mt-2 text-sm text-nova-ash">
              Surface 2 with shadow-md. Used for cards that sit above the
              page, like modals or popovers.
            </p>
          </div>

          <div className="rounded-lg border border-nova-ember bg-nova-crypt p-8 shadow-glow">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-nova-ember">
              Featured
            </span>
            <h3 className="mt-2 text-xl font-display font-bold text-nova-bone">
              Accent
            </h3>
            <p className="mt-2 text-sm text-nova-ash">
              Reserved for a single highlighted item per view — never more.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
