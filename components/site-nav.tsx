import Link from "next/link";
import { WalletConnect } from "@/components/wallet/wallet-connect";

// App-side header nav (rule 10: every feature reachable by clicking).
// Wordmark + brand dot, quiet text links, wallet on the right.
// The marketing shell uses components/landing-nav.tsx instead.
export function SiteNav() {
  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-2">
      <Link
        href="/"
        className="flex items-center gap-1.5 no-underline transition-opacity duration-300 hover:opacity-60"
      >
        <span className="t-display-24 text-ink">AskBounty</span>
        <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
      </Link>

      <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link
          href="/browse"
          className="t-body-14-medium text-ink no-underline transition-opacity duration-300 hover:opacity-60"
        >
          Browse
        </Link>
        <Link
          href="/activity"
          className="t-body-14-medium text-ink no-underline transition-opacity duration-300 hover:opacity-60"
        >
          My activity
        </Link>
        <Link
          href="/ask"
          className="t-body-14-medium text-ink no-underline transition-opacity duration-300 hover:opacity-60"
        >
          Ask a question
        </Link>
        <WalletConnect />
      </nav>
    </header>
  );
}
