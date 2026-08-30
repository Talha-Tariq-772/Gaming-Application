export default function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-nova-hairline bg-nova-slab px-3 py-1 text-xs font-medium uppercase tracking-[0.05em] text-nova-ash">
      {children}
    </span>
  );
}
