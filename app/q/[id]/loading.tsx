// Route-level skeleton while the question page reads DB + chain state.
export default function QuestionLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="h-9 w-full max-w-sm animate-pulse rounded-md bg-muted" />
      <div className="h-8 w-3/4 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-16 animate-pulse rounded-lg border bg-muted/50" />
      <div className="h-32 animate-pulse rounded-lg border bg-muted/50" />
      <div className="h-24 animate-pulse rounded-lg border bg-muted/50" />
    </main>
  );
}
