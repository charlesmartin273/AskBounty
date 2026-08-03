// Route-level skeleton while the question page reads DB + chain state.
export default function QuestionLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="h-9 w-full max-w-sm animate-pulse rounded-lg bg-muted" />
      <div className="h-11 w-3/4 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-56 animate-pulse rounded-lg bg-muted" />
      {/* Skeleton blocks echo the paper cards they stand in for. */}
      <div className="h-16 animate-pulse rounded-xl bg-paper/60" />
      <div className="h-32 animate-pulse rounded-xl bg-paper/60" />
      <div className="h-24 animate-pulse rounded-xl bg-paper/60" />
    </main>
  );
}
