// Route-level skeleton while the browse list does its live DB read.
export default function BrowseLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="h-9 w-full max-w-sm animate-pulse rounded-lg bg-muted" />
      <div className="h-10 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          // Skeleton rows echo the paper cards they stand in for.
          <div key={i} className="h-24 animate-pulse rounded-xl bg-paper/60" />
        ))}
      </div>
    </main>
  );
}
