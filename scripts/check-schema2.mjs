import { readFileSync } from "fs";
const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/m);
  if (m) process.env[m[1]] = m[2].trim();
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const anonKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase exposes the OpenAPI spec of the public schema
const res = await fetch(`${url}/rest/v1/?apikey=${anonKey}`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
});
const spec = await res.json();

const tj = spec.definitions?.teaching_journals;
if (!tj) {
  console.log("teaching_journals NOT exposed in API spec");
} else {
  console.log("teaching_journals columns:");
  for (const [col, def] of Object.entries(tj.properties)) {
    console.log(`  - ${col}: ${def.format || def.type}${def.default !== undefined ? ` (default: ${def.default})` : ""}${tj.required?.includes(col) ? " NOT NULL" : ""}`);
  }
}
console.log("\ntables exposed via API:", Object.keys(spec.definitions || {}).join(", "));
