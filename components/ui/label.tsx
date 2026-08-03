"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Form labels speak in the eyebrow voice: Geist Mono, 12px, uppercase,
 * positive tracking - the only preset that tracks OUT (design-system.md §2.4).
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "t-label flex items-center gap-2 text-muted-ink select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
