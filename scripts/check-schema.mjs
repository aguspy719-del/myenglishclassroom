// One-off schema verification for the teaching journal + quiz attempts tables.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/m);
  if (m) process.env[m[1]] = m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const sb = createClient(url, serviceKey);

// 1. teaching_journals — exists? columns? row count?
const { data: tj, error: tjErr } = await sb.from("teaching_journals").select("*").limit(2);
console.log("teaching_journals query:", tjErr ? `ERROR: ${tjErr.message}` : `OK, got ${tj?.length ?? 0} sample row(s)`);
if (tj && tj[0]) console.log("teaching_journals columns:", Object.keys(tj[0]).join(", "));
const { count: tjCount } = await sb.from("teaching_journals").select("*", { count: "exact", head: true });
console.log("teaching_journals total rows:", tjCount);

// 2. quiz_attempts — current columns
const { data: qa, error: qaErr } = await sb.from("quiz_attempts").select("*").limit(1);
console.log("\nquiz_attempts query:", qaErr ? `ERROR: ${qaErr.message}` : "OK");
if (qa && qa[0]) console.log("quiz_attempts columns:", Object.keys(qa[0]).join(", "));

// 3. RLS sanity via anon key (what the app browser client uses, unauthenticated)
const sbAnon = createClient(url, anonKey);
const { error: anonErr } = await sbAnon.from("teaching_journals").select("*").limit(1);
console.log("\nteaching_journals via anon (unauth):", anonErr ? `blocked: ${anonErr.message}` : "READABLE (RLS may be missing!)");
