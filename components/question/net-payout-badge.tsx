import { Badge } from "@/components/ui/badge";
import { usdcDisplay } from "@/lib/format-usdc";

// The number promised BEFORE anyone writes a word (PRD-ERRATA E2, yêu cầu 1).
// Values come from the DB snapshot taken at question creation - NOT re-read -
// so later admin fee changes never change what this page promised.
// Amounts render in the mono money voice (t-num, decision 3).
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Badge variant="success">
        Bounty {usdcDisplay(budget)} USDC locked
      </Badge>
      <span className="t-body-14-medium text-ink">
        winner receives <span className="t-num">{usdcDisplay(netPayout)} USDC</span>{" "}
        after protocol fees
        {totalBp === 0 && " (0% today)"}
      </span>
      <span className="t-hash text-faint">
        fees locked at creation: platform {platformFeeBp} bp · evaluator {evaluatorFeeBp} bp
      </span>
    </div>
  );
}
