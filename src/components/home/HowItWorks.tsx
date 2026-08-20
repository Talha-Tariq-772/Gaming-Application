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
    <section className="border-y border-border bg-surface-1">
      <div className="mx-auto max-w-page px-4 py-16 md:px-8">
        <h2 className="mb-10 font-display text-2xl font-bold text-text md:text-3xl">
          How It Works
        </h2>
        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex flex-col gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent text-sm font-bold text-accent">
                {i + 1}
              </span>
              <span className="font-display text-lg font-bold text-text">
                {step.label}
              </span>
              <span className="text-sm text-text-muted">
                {step.description}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
