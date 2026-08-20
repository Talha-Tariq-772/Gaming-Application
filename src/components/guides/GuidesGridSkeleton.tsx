export default function GuidesGridSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex h-32 flex-col gap-3 rounded-lg border border-border bg-surface-1 p-6"
        >
          <div className="h-4 w-2/3 rounded bg-surface-2" />
          <div className="h-3 w-full rounded bg-surface-2" />
          <div className="h-3 w-4/5 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
