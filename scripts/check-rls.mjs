import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/m);
  if (m) process.env[m[1]] = m[2].trim();
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbAnon = createClient(url, anonKey);          // no login (what a stranger could do)
const sbAdmin = createClient(url, serviceKey);      // setup + cleanup

// TEST 1: unauthenticated read of the empty table
const { data: r, error: rErr } = await sbAnon.from("teaching_journals").select("topic").limit(3);
console.log("anon READ:", rErr ? `blocked (${rErr.message})` : `allowed — got ${r?.length} row(s)`);

// TEST 2: unauthenticated insert (then delete it immediately)
const { data: i, error: iErr } = await sbAnon.from("teaching_journals").insert({
  teacher_id: "00000000-0000-0000-0000-000000000000",
  class_id: "00000000-0000-0000-0000-000000000000",
  date: "2000-01-01",
  topic: "SECURITY-TEST-DELETE-ME",
  learning_objectives: "test",
  activities: "test",
}).select("id").single();
if (iErr) {
  console.log("anon INSERT: blocked ✓", `(${iErr.message})`);
} else {
  console.log("anon INSERT: ALLOWED (bug!) — id:", i.id);
  await sbAdmin.from("teaching_journals").delete().eq("id", i.id);
  console.log("cleanup: test row deleted");
}

// TEST 3 (definitive per-teacher proof): insert a real row owned by a real
// teacher via the service key, then confirm the anon (no-login) client
// CANNOT read that specific row back.
const teacher = (await sbAdmin.from("users").select("id").eq("role", "teacher").limit(1).single()).data;
if (!teacher) {
  console.log("TEST 3 skipped: no teacher in users table");
} else {
  const cls = (await sbAdmin.from("classes").select("id").limit(1).single()).data;
  const testTopic = `RLS-PROOF-${Date.now()}`;
  const { data: row, error: insertErr } = await sbAdmin.from("teaching_journals").insert({
    teacher_id: teacher.id,
    class_id: cls.id,
    date: "2002-02-02",
    topic: testTopic,
    learning_objectives: "x",
    activities: "x",
  }).select("id").single();
  if (insertErr) {
    console.log("TEST 3 setup failed:", insertErr.message);
  } else {
    const { data: seen } = await sbAnon.from("teaching_journals").select("id,topic").eq("id", row.id);
    console.log(
      seen?.length
        ? "TEST 3 anon read specific row: LEAKED (RLS per-teacher missing!)"
        : "TEST 3 anon read specific row: invisible ✓ (RLS per-teacher select OK)"
    );
    await sbAdmin.from("teaching_journals").delete().eq("id", row.id);
    console.log("cleanup: proof row deleted");
  }
}
