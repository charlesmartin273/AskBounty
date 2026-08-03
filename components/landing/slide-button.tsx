import Link from "next/link";

/**
 * Pill CTA with the Orionix label-slide hover: two identical labels stacked
 * in a 20px viewport; hover slides the stack up so the duplicate takes the
 * first one's place. Pure CSS (group-hover), server-rendered.
 */
export function SlideButton({
  href,
  label,
  variant = "black",
}: {
  href: string;
  label: string;
  variant?: "black" | "white";
}) {
  const dark = variant === "black";
  return (
    <Link href={href} className="group inline-flex no-underline">
      <span
        className={`flex h-12 items-center overflow-clip rounded-full px-6 shadow-button ${
          dark ? "bg-ink" : "bg-paper"
        }`}
      >
        {/* h-5 viewport over two stacked labels; hover shifts by label+gap. */}
        <span className="flex h-5 flex-col items-center gap-5 transition-transform duration-300 ease-[cubic-bezier(0.44,0,0.56,1)] group-hover:-translate-y-10">
          <span className={`t-body-14-medium whitespace-pre ${dark ? "text-cream" : "text-ink"}`}>
            {label}
          </span>
          <span
            aria-hidden="true"
            className={`t-body-14-medium whitespace-pre ${dark ? "text-cream" : "text-ink"}`}
          >
            {label}
          </span>
        </span>
      </span>
    </Link>
  );
}
