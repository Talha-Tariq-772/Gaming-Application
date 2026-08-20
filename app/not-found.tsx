import Button from "@/components/Button";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex max-w-page flex-col items-center justify-center gap-6 px-4 py-48 text-center md:px-8"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        404
      </span>
      <h1 className="text-display-sm font-display font-extrabold text-text">
        Page not found
      </h1>
      <p className="max-w-sm text-sm text-text-muted">
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have
        been moved.
      </p>
      <Button as="a" href="/games" variant="secondary">
        Back to Store
      </Button>
    </main>
  );
}
