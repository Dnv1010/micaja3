import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const key =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;
if (!key) throw new Error("No SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local");

let url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
if (!url) {
  const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString());
  url = `https://${payload.ref}.supabase.co`;
  console.log(`[info] URL derivada del JWT: ${url}\n`);
}

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}
const spec = await res.json();

const tables = Object.entries(spec.definitions || spec.components?.schemas || {});
console.log(`Tablas: ${tables.length}\n`);

for (const [name, def] of tables) {
  const props = def.properties || {};
  const required = new Set(def.required || []);
  console.log(`## ${name}`);
  for (const [col, meta] of Object.entries(props)) {
    const type = meta.format || meta.type || "?";
    const req = required.has(col) ? " NOT NULL" : "";
    const desc = meta.description ? ` -- ${meta.description.replace(/\n/g, " ")}` : "";
    console.log(`  ${col.padEnd(32)} ${String(type).padEnd(16)}${req}${desc}`);
  }
  console.log();
}
