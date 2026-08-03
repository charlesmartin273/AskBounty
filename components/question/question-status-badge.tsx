import { Badge } from "@/components/ui/badge";

// One shared mapping from question lifecycle -> money-state palette
// (design-system.md §1.3). Temporal story: amber while money is in flight,
// green when settled, gray when closed with nothing owed. Never brand red.
const STATUS_VARIANT: Record<string, "success" | "pending" | "fail" | "neutral"> = {
  open: "pending",
  answered: "success",
  expired: "neutral",
  refunded: "neutral",
  draft: "neutral",
};

export function QuestionStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>{status}</Badge>;
}
