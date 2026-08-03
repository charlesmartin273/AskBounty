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
    // Paper card row, no border/shadow; the whole card is the link. Hover
    // nudges opacity like every other interactive surface (300ms brand ease).
    <Link
      href={`/q/${q.id}`}
      className="flex items-center justify-between gap-4 rounded-xl bg-paper p-6 no-underline transition-opacity duration-300 ease-[cubic-bezier(0.44,0,0.56,1)] hover:opacity-70"
    >
      <div className="min-w-0 space-y-1">
        <p className="t-display-20 truncate text-ink">{q.title}</p>
        <p className="t-body-14 text-muted-ink">
          winner receives <span className="t-num">{usdcDisplay(q.netPayout)} USDC</span>{" "}
          · {timeLeft(q.deadline)}
        </p>
      </div>
      {/* Bounty amount: mono chip on the quiet gray tag fill */}
      <span className="t-num shrink-0 rounded-full bg-line-2 px-4 py-2 text-ink">
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
