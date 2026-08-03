import Link from "next/link";
import { LandingNav } from "@/components/landing-nav";
import { PageTexture } from "@/components/page-texture";

// Shown for unknown routes and unknown/invalid question ids (notFound()).
// Nav note: this file sits OUTSIDE the (app) group, so it renders without
// Providers - SiteNav would call wagmi hooks with no WagmiProvider above and
// throw. LandingNav is the wallet-free nav and gives the same way back.
export default function NotFound() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <PageTexture intensity="work" />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
        <LandingNav />
        <main className="flex flex-1 flex-col items-start justify-center gap-4 pb-24">
          <h1 className="t-display-40 text-ink">Page not found</h1>
          <p className="t-body-14 text-muted-ink">
            This page or question does not exist. The link may be wrong, or the
            question was never created.
          </p>
          <Link
            href="/browse"
            className="t-body-14-medium text-brand no-underline hover:underline"
          >
            Browse open bounties →
          </Link>
        </main>
      </div>
    </div>
  );
}
