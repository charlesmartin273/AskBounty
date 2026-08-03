// Route-level skeleton for the ask form. Blocks mirror the real layout:
// nav, title, two text fields, the budget/deadline row, the criteria card.
export default function AskLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div className="h-9 w-full max-w-sm animate-pulse rounded-lg bg-muted" />
      <div className="h-11 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-4">
        <div className="h-11 animate-pulse rounded-full bg-paper/60" />
        <div className="h-28 animate-pulse rounded-xl bg-paper/60" />
        <div className="flex gap-4">
          <div className="h-11 w-32 animate-pulse rounded-full bg-paper/60" />
          <div className="h-11 w-56 animate-pulse rounded-full bg-paper/60" />
        </div>
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-paper/60" />
    </main>
  );
}
