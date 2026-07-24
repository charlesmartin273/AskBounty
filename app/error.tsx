"use client";

import { Button } from "@/components/ui/button";

// Root error boundary: a DB/RPC hiccup shows a friendly retry screen
// instead of Next's raw error page. Funds are never at risk from a render
// failure — escrow state lives onchain.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        A temporary error occurred while loading this page (network or database
        hiccup). Your funds are unaffected — escrow state lives onchain.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">ref: {error.digest}</p>
      )}
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
