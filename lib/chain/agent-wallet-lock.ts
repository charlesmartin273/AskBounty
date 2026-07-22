import "server-only";

// H2 (Phase 1 review): the agent wallet signs setBudget, submit, complete and
// the winner forward tx. Concurrent requests sharing that one key would
// collide on nonces, so EVERY agent-wallet write sequence runs through this
// in-process promise queue. Deployment constraint: single running instance
// (documented in README) — the DB CAS claims in the payout pipeline keep
// retries idempotent if that assumption ever breaks.
let queue: Promise<unknown> = Promise.resolve();

export function withAgentWallet<T>(fn: () => Promise<T>): Promise<T> {
  // Run after whatever is queued, regardless of whether it failed.
  const run = queue.then(fn, fn);
  // Swallow the error on the QUEUE copy only — callers still see the rejection.
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
