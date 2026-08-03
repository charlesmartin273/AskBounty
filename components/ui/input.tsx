import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Single-line fields are pills (design-system.md §5.4): white fill,
 * hairline border, radius 999px, faint placeholder. Validation errors use
 * `destructive` (muted brick), never the brand red.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Type note: 16px on mobile, 14px from md up. This is the one place
        // that stays off the t-* scale - iOS zooms the viewport on focus for
        // any field under 16px, and the scale has no responsive variants
        // (presets live in @layer components).
        "h-11 w-full min-w-0 rounded-full border border-input bg-paper px-5 py-2 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-faint focus-visible:border-line-4 focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
