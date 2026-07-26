import Link from "next/link";

// Shown for unknown routes and unknown/invalid question ids (notFound()).
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        This page or question does not exist. The link may be wrong, or the
        question was never created.
      </p>
      <Link href="/browse" className="text-sm underline">
        Browse open bounties →
      </Link>
    </main>
  );
}
