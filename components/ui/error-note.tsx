import type { FriendlyError } from "@/lib/ui/friendly-error";

// Standard inline error display: friendly headline in the state-fail colour
// (muted brick - never the brand red, decision 2), raw technical detail
// demoted to small mono text underneath.
export function ErrorNote({ error }: { error: FriendlyError | null }) {
  if (!error) return null;
  return (
    <div className="space-y-1">
      <p className="t-body-14 text-fail">{error.message}</p>
      {error.detail && (
        <p className="t-hash break-all text-faint">{error.detail}</p>
      )}
    </div>
  );
}
