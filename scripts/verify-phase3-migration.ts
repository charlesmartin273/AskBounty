// Probes whether migration-003 (unique index + status CHECKs) is applied,
// using throwaway rows via the service-role client. Cleans up after itself.
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const qid = "qprobe0000mig"; // 13 chars, q + 12 - NOT a real question-id shape
  await db.from("answers").delete().eq("question_id", qid);
  await db.from("questions").delete().eq("id", qid);

  const { error: qErr } = await db.from("questions").insert({
    id: qid, asker_address: "0xdead", title: "probe", body: "probe",
    budget: "1", criteria: {}, status: "open",
    deadline: new Date(Date.now() + 60000).toISOString(),
  });
  if (qErr) { console.log(`PROBE-ERROR question insert: ${qErr.message}`); process.exit(2); }

  // status CHECK probe
  const { error: badStatus } = await db.from("answers").insert({
    question_id: qid, answerer_address: "0xdead", body: "x", status: "bogus",
  });
  console.log(`check-constraint answers.status: ${badStatus ? "APPLIED (" + badStatus.message + ")" : "MISSING - bogus status accepted"}`);
  if (!badStatus) await db.from("answers").delete().eq("question_id", qid);

  // unique index probe
  const { error: e1 } = await db.from("answers").insert({
    question_id: qid, answerer_address: "0xdead", body: "a1", status: "accepted",
  });
  const { error: e2 } = await db.from("answers").insert({
    question_id: qid, answerer_address: "0xdead", body: "a2", status: "accepted",
  });
  console.log(`first accepted insert: ${e1 ? "FAILED " + e1.message : "ok"}`);
  console.log(`unique index one_accepted_per_question: ${e2 ? "APPLIED (" + e2.message + ")" : "MISSING - second accepted row allowed"}`);

  // default 'draft' probe
  const qid2 = "qprobe0001mig";
  await db.from("questions").delete().eq("id", qid2);
  const { data: defRow, error: defErr } = await db.from("questions").insert({
    id: qid2, asker_address: "0xdead", title: "probe", body: "probe",
    budget: "1", criteria: {},
    deadline: new Date(Date.now() + 60000).toISOString(),
  }).select("status").single();
  console.log(`questions.status default: ${defErr ? "insert failed " + defErr.message : defRow?.status === "draft" ? "APPLIED ('draft')" : `MISSING (default '${defRow?.status}')`}`);

  // cleanup
  await db.from("answers").delete().eq("question_id", qid);
  await db.from("questions").delete().eq("id", qid);
  await db.from("questions").delete().eq("id", qid2);
  console.log("cleanup done");
}

main().catch((e) => { console.error(e); process.exit(1); });
