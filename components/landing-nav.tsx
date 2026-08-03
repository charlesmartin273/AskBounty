import Link from "next/link";
import { SlideButton } from "@/components/landing/slide-button";

// Marketing-side nav: transparent bar, no wallet, no wagmi import - the
// landing bundle must stay free of web3 deps (route-group decision A).
// Enters with the Orionix nav move: fade + slide down from -24px, CSS only.
export function LandingNav() {
  return (
    <header className="animate-enter-down flex h-24 w-full items-center justify-between">
      <Link
        href="/"
        className="flex items-center gap-1.5 no-underline transition-opacity duration-300 hover:opacity-60"
      >
        <span className="t-display-24 text-ink">AskBounty</span>
        <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
      </Link>

      <SlideButton href="/browse" label="Launch app" variant="black" />
    </header>
  );
}
