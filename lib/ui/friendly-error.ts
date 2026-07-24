// Maps raw wallet/RPC/API errors to short human copy. The raw text (viem
// puts the revert reason on line 2) is kept as `detail` so it can be shown
// small instead of as the headline.
export interface FriendlyError {
  message: string;
  detail?: string;
}

// For errors whose message is ALREADY user-facing copy (API `error` strings
// like "cooldown: wait 58s…") — passed through as the headline untouched.
export class UserFacingError extends Error {}

const RULES: { pattern: RegExp; message: string }[] = [
  {
    pattern: /user rejected|user denied|rejected the request|action_rejected/i,
    message: "Request cancelled in your wallet — nothing was sent.",
  },
  {
    pattern: /insufficient funds|exceeds balance|transfer amount exceeds|insufficient balance/i,
    message: "Not enough USDC in this wallet. On Arc, USDC also pays gas — top up at faucet.circle.com.",
  },
  {
    pattern: /chain mismatch|wrong chain|does not match the target chain/i,
    message: "Wrong network — switch your wallet to Arc Testnet and retry.",
  },
  {
    pattern: /rate limit|429|too many requests/i,
    message: "The network is rate-limiting requests. Wait a few seconds and retry.",
  },
  {
    pattern: /fetch failed|failed to fetch|network error|timed? ?out|econnre/i,
    message: "Network hiccup — check your connection and retry.",
  },
];

export function toFriendlyError(err: unknown): FriendlyError {
  if (err instanceof UserFacingError) {
    return /^HTTP \d+$/.test(err.message)
      ? { message: `The server returned an error (${err.message}) — please retry.` }
      : { message: err.message };
  }
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  // keep the first informative lines (viem revert reason lives on line 2)
  const detail = raw.split("\n").filter(Boolean).slice(0, 3).join(" ").slice(0, 300);
  for (const rule of RULES) {
    if (rule.pattern.test(raw)) return { message: rule.message, detail };
  }
  return { message: "Something went wrong.", detail };
}
