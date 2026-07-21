import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS } from "./chain/config";

// 6-decimal USDC helpers shared by API routes and UI. Amounts cross the API
// boundary as decimal strings; Postgres NUMERIC arrives as a JSON number via
// PostgREST — accept both, never do float math.

export function usdcToRaw(amount: string | number): bigint {
  return parseUnits(String(amount).trim(), USDC_DECIMALS);
}

export function rawToUsdc(raw: bigint): string {
  return formatUnits(raw, USDC_DECIMALS);
}

// Display with exactly 2 decimals ("20" -> "20.00") for badges/copy.
export function usdcDisplay(amount: string | number): string {
  const [int, frac = ""] = String(amount).split(".");
  return `${int}.${(frac + "00").slice(0, 2)}`;
}
