import Link from "next/link";

// Shared header nav (rule 10: every feature reachable by clicking).
export function SiteNav() {
  return (
    <div className="flex items-center justify-between">
      <Link href="/" className="text-xl font-bold">AskBounty</Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/browse" className="underline">Browse</Link>
        <Link href="/activity" className="underline">My activity</Link>
        <Link href="/ask" className="underline">Ask a question</Link>
      </nav>
    </div>
  );
}
