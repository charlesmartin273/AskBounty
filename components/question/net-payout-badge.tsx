import { Badge } from "@/components/ui/badge";
import { usdcDisplay } from "@/lib/format-usdc";

// The number promised BEFORE anyone writes a word (PRD-ERRATA E2, yêu cầu 1).
// Values come from the DB snapshot taken at question creation - NOT re-read -
// so later admin fee changes never change what this page promised.
export function NetPayoutBadge({
  budget,
  netPayout,
  platformFeeBp,
  evaluatorFeeBp,
}: {
  budget: string;
  netPayout: string;
  platformFeeBp: number;
  evaluatorFeeBp: number;
}) {
  const totalBp = platformFeeBp + evaluatorFeeBp;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className="bg-green-600 text-white hover:bg-green-600">
        Bounty {usdcDisplay(budget)} USDC locked
      </Badge>
      <span className="text-sm font-medium">
        winner receives {usdcDisplay(netPayout)} USDC after protocol fees
        {totalBp === 0 && " (0% today)"}
      </span>
      <span className="text-xs text-muted-foreground">
        fees locked at creation: platform {platformFeeBp} bp · evaluator {evaluatorFeeBp} bp
      </span>
    </div>
  );
}
