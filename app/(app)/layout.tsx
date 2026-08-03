import { PageTexture } from "@/components/page-texture";
import { Providers } from "./providers";

// App shell: every wallet-facing route lives under this group, so wagmi +
// react-query load only here. The (marketing) group ships zero web3 code.
//
// Same paper as the landing, at "work" strength: the texture is there so the
// two halves feel like one product, but it never competes with a hash, an
// amount or a form field. No scroll-reveal here either - the app is a tool.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="relative flex min-h-full flex-1 flex-col">
        <PageTexture intensity="work" />
        {children}
      </div>
    </Providers>
  );
}
