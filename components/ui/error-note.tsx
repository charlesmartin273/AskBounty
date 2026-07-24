import type { FriendlyError } from "@/lib/ui/friendly-error";

// Standard inline error display: friendly headline, raw technical detail
// demoted to small mono text underneath.
export function ErrorNote({ error }: { error: FriendlyError | null }) {
  if (!error) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm text-red-600">{error.message}</p>
      {error.detail && (
        <p className="break-all font-mono text-xs text-muted-foreground">{error.detail}</p>
      )}
    </div>
  );
}
