import { PageTexture } from "@/components/page-texture";

// Marketing shell: transparent nav, no wallet, no wagmi. Carries the page
// texture at full "display" strength - this is the page that shows the
// material off. The app group uses the same layers, dialled down.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <PageTexture intensity="display" />
      {children}
    </div>
  );
}
