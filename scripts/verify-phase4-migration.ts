// Probes whether migration-004 is applied ('refunded' status allowed +
// refund_tx column exists) using throwaway rows. Cleans up after itself.
// Run: npx tsx scripts/verify-phase4-migration.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const qid = "qprobe0004mig";
  await db.from("questions").delete().eq("id", qid);

  const { error: statusErr } = await db.from("questions").insert({
    id: qid, asker_address: "0xdead", title: "probe", body: "probe",
    budget: "1", criteria: {}, status: "refunded",
    deadline: new Date(Date.now() + 60000).toISOString(),
  });
  console.log(
    `status 'refunded' allowed: ${statusErr ? "MISSING (" + statusErr.message + ")" : "APPLIED"}`,
  );

  if (!statusErr) {
    const { error: colErr } = await db
      .from("questions")
      .update({ refund_tx: "0xprobe" })
      .eq("id", qid);
    console.log(
      `refund_tx column: ${colErr ? "MISSING (" + colErr.message + ")" : "APPLIED"}`,
    );
  }

  await db.from("questions").delete().eq("id", qid);
  console.log("cleanup done");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
