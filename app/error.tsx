"use client";

import { PageTexture } from "@/components/page-texture";
import { Button } from "@/components/ui/button";

// Root error boundary: a DB/RPC hiccup shows a friendly retry screen
// instead of Next's raw error page. Funds are never at risk from a render
// failure - escrow state lives onchain.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-4 p-6">
      <PageTexture intensity="work" />
      <h1 className="t-display-40 text-ink">Something went wrong</h1>
      <p className="t-body-14 text-muted-ink">
        A temporary error occurred while loading this page (network or database
        hiccup). Your funds are unaffected - escrow state lives onchain.
      </p>
      {error.digest && (
        <p className="t-hash text-faint">ref: {error.digest}</p>
      )}
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
