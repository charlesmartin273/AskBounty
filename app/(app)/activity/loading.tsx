// Route-level skeleton for My activity: nav, title, the asked/answered tab
// pair, then rows echoing the paper cards they stand in for.
export default function ActivityLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="h-9 w-full max-w-sm animate-pulse rounded-lg bg-muted" />
      <div className="h-11 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-2">
        <div className="h-7 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-7 w-32 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-paper/60" />
        ))}
      </div>
    </main>
  );
}
