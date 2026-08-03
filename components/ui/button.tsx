import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Buttons follow the design language (docs/design-system.md §5.1):
 * full pill radius, ink or paper fills, and they are the ONLY elements
 * that carry a shadow - everything else on the page stays flat.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent font-medium tracking-[-0.28px] whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.44,0,0.56,1)] outline-none select-none focus-visible:border-line-4 focus-visible:ring-3 focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* ink pill - the one raised object on the page */
        default: "bg-primary text-primary-foreground shadow-button hover:opacity-90",
        /* paper pill, same lift - the "white" Orionix variant */
        secondary: "bg-paper text-ink shadow-button hover:opacity-90",
        /* flat hairline pill for tertiary actions */
        outline: "border-line-3 bg-paper text-ink hover:bg-muted",
        ghost: "text-ink hover:bg-muted",
        /* state action (e.g. wrong network) - muted brick, never brand red */
        destructive:
          "border-fail-line bg-fail-bg text-fail hover:bg-fail/15 focus-visible:border-fail-line focus-visible:ring-fail/20",
        /* inline link - brand red per decision 2 */
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default:
          "t-body-14-medium h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "t-body-12-medium h-7 gap-1 px-3 [&_svg:not([class*='size-'])]:size-3",
        /* 13px sits between two steps of the scale on purpose: 14 crowds the
           32px pill, 12 reads as a chip. Base weight/tracking still apply. */
        sm: "h-8 gap-1.5 px-4 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "t-body-14-medium h-12 gap-2 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
