export default function GameCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-3/4 rounded-lg border border-nova-hairline bg-nova-crypt" />
      <div className="flex flex-col gap-1.5">
        <div className="h-5 w-3/4 rounded bg-nova-crypt" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-nova-crypt" />
          <div className="h-5 w-20 rounded-full bg-nova-crypt" />
        </div>
        <div className="mt-1 h-4 w-20 rounded bg-nova-crypt" />
      </div>
    </div>
  );
}
