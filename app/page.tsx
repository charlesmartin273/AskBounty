import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <SiteNav />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-4xl font-bold">AskBounty</h1>
        <p className="text-lg text-muted-foreground">
          Post a question, lock a USDC bounty in ERC-8183 escrow on Arc Testnet. An AI
          evaluation agent scores answers against your criteria. The first passing answer
          is paid instantly, onchain.
        </p>
        <div className="flex gap-3">
          <Link href="/browse">
            <Button size="lg" variant="outline">Browse bounties</Button>
          </Link>
          <Link href="/ask">
            <Button size="lg">Ask a question</Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Money and criteria locked together, upfront. No rug-pulls: escrow rides to
          acceptance or refund.
        </p>
      </div>
    </main>
  );
}
