/** Eyebrow pill: white pill + brand dot + mono label (design-system.md §5.2). */
export function Pill({ label }: { label: string }) {
  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-paper px-3 py-1.5">
      <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
      <span className="t-label text-ink">{label}</span>
    </div>
  );
}
