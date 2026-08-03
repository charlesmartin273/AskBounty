import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Multi-line fields keep the card radius (24px) instead of the pill
 * (design-system.md §5.4). Same paper fill + hairline as Input.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Same 16px-on-mobile iOS zoom guard as Input - deliberately off the
        // t-* scale, see components/ui/input.tsx.
        "flex field-sizing-content min-h-24 w-full rounded-xl border border-input bg-paper px-5 py-4 text-base transition-colors outline-none placeholder:text-faint focus-visible:border-line-4 focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
