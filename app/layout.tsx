import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

/**
 * Fraunces - display serif, driven through its variable axes
 * ("SOFT" 100, "WONK" 1 via font-variation-settings in globals.css).
 * The axes must be requested here or next/font strips them from the file.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/* Geist Mono: USDC amounts, wallet addresses, tx hashes, labels. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://askbounty.vercel.app"),
  title: {
    default: "AskBounty: USDC bounties for answers, escrowed on Arc",
    template: "%s · AskBounty",
  },
  description:
    "Post a question, lock USDC in escrow on Arc Testnet. An AI agent evaluates answers against your criteria. The first passing answer is paid instantly.",
  openGraph: {
    title: "AskBounty",
    description:
      "USDC question bounties with onchain escrow and AI evaluation on Arc Testnet.",
    siteName: "AskBounty",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Providers (wagmi/react-query) moved into app/(app)/layout.tsx so the
          marketing group stays free of web3 dependencies. */}
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
