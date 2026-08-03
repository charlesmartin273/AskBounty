import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badges are mono-uppercase chips (the t-label voice). Money-state variants
 * (success / pending / fail / neutral) use the low-saturation state palette -
 * NEVER the brand red (design-system.md §1.3, decision 2):
 *   paid, accepted            -> success
 *   open, payout_pending      -> pending
 *   failed, payout_failed     -> fail
 *   expired, refunded, draft  -> neutral
 */
const badgeVariants = cva(
  // Type note: t-label at 11px instead of 12px - the scale's label preset
  // overflows a 24px pill once a status word like "payout pending" is in it.
  // Same family, weight and uppercase, one step tighter.
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 font-mono text-[11px] font-medium tracking-[0.3px] uppercase whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        /* quiet tag on paper - rgba(0,0,0,0.06), the Orionix category chip */
        secondary: "bg-line-2 text-ink [a]:hover:bg-line-3",
        outline: "border-line-3 text-ink [a]:hover:bg-muted",
        ghost: "text-muted-ink hover:bg-muted",
        link: "text-brand underline-offset-4 hover:underline",

        /* --- money-state variants --- */
        success: "border-success-line bg-success-bg text-success",
        pending: "border-pending-line bg-pending-bg text-pending",
        fail: "border-fail-line bg-fail-bg text-fail",
        neutral: "border-neutral-state-line bg-neutral-state-bg text-neutral-state",
        /* legacy alias kept so existing call sites compile; renders as fail */
        destructive: "border-fail-line bg-fail-bg text-fail",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
