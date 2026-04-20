// Consulta a information_schema via postgres para saber en qué schema están las tablas.
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  fs
    .readFileSync(path.resolve(".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString());
const url = env.NEXT_PUBLIC_SUPABASE_URL || `https://${payload.ref}.supabase.co`;

// Usamos pg_meta via Supabase (endpoint disponible en proyectos Supabase)
const r = await fetch(`${url}/rest/v1/rpc/pg_meta_tables_query`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: "{}",
});
console.log(r.status, await r.text().catch(() => "<no body>"));
