import Link from "next/link";
import { usdcDisplay } from "@/lib/format-usdc";

export interface BrowseQuestion {
  id: string;
  title: string;
  budget: string;
  netPayout: string;
  deadline: string;
}

// One row in the public browse list. Server-rendered; time-left is a coarse
// static label (the live countdown lives on the question page).
export function QuestionCard({ q }: { q: BrowseQuestion }) {
  return (
    <Link
      href={`/q/${q.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border p-4 hover:bg-accent"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{q.title}</p>
        <p className="text-xs text-muted-foreground">
          winner receives {usdcDisplay(q.netPayout)} USDC · {timeLeft(q.deadline)}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-medium">
        {usdcDisplay(q.budget)} USDC
      </span>
    </Link>
  );
}

function timeLeft(deadline: string): string {
  const ms = Date.parse(deadline) - Date.now();
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return `${Math.floor(hours / 24)} days left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}
