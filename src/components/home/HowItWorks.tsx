const STEPS = [
  {
    label: "Browse",
    description: "Filter by platform, genre, or price and add what you want.",
  },
  {
    label: "Pay",
    description: "Pick a payment method and send the exact amount shown.",
  },
  {
    label: "Send Screenshot",
    description: "Tap “I have made the payment” and share it on WhatsApp.",
  },
  {
    label: "Get Access",
    description: "Once verified — typically 1–2 hours — reveal your credentials.",
  },
];

export default function HowItWorks() {
  return (
    <section className="border-y border-nova-hairline bg-nova-crypt">
      <div className="mx-auto max-w-page px-4 py-16 md:px-8">
        {/* Single fluid size (--text-heading, globals.css), not a
            breakpoint jump to text-3xl — see Session 7's typography pass. */}
        <h2 className="mb-10 font-display text-2xl font-bold text-nova-bone">
          How It Works
        </h2>
        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex flex-col gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-nova-ember text-sm font-bold text-nova-ember-text">
                {i + 1}
              </span>
              {/* Barlow, not the display face — a label, not display type. See
                  .text-card-heading (globals.css). Its old font-display
                  text-lg (--text-heading, up to 40px) overflowed this
                  4-column grid's ~300px columns for "Send Screenshot",
                  measured colliding into "Get Access" by 13-21px. */}
              <span className="text-card-heading text-nova-bone">
                {step.label}
              </span>
              <span className="text-sm text-nova-ash">
                {step.description}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
