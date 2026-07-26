import { NextResponse } from "next/server";
import { publicClient } from "@/lib/chain/clients";
import { readFeeBps } from "@/lib/escrow/escrow-reads";

// GET /api/fees - live protocol fee BPs for the ask-form net-payout preview.
// Display-only: the authoritative snapshot is taken server-side at question
// creation (POST /api/questions).
export async function GET() {
  const bps = await readFeeBps(publicClient);
  return NextResponse.json({
    platformFeeBP: Number(bps.platformFeeBP),
    evaluatorFeeBP: Number(bps.evaluatorFeeBP),
  });
}
