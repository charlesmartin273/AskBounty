// Route-level skeleton while the browse list does its live DB read.
export default function BrowseLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="h-9 w-full max-w-sm animate-pulse rounded-md bg-muted" />
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/50" />
        ))}
      </div>
    </main>
  );
}
