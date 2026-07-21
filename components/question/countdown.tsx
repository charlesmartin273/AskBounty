"use client";

import { useEffect, useState } from "react";

function remaining(deadline: string): string {
  const ms = Date.parse(deadline) - Date.now();
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s % 60}s`;
  return `${m}m ${s % 60}s`;
}

// Live ticking countdown to the question deadline.
export function Countdown({ deadline }: { deadline: string }) {
  const [text, setText] = useState(() => remaining(deadline));
  useEffect(() => {
    const t = setInterval(() => setText(remaining(deadline)), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  return (
    <span className={text === "expired" ? "font-medium text-red-600" : "font-medium"}>
      {text === "expired" ? "Deadline passed" : `Closes in ${text}`}
    </span>
  );
}
