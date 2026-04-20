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

const h = { apikey: key, Authorization: `Bearer ${key}` };

// Fetch OpenAPI spec to inspect enum definitions
const spec = await (await fetch(`${url}/rest/v1/`, { headers: h })).json();

console.log("=== ENUMS (desde OpenAPI) ===\n");
for (const [name, def] of Object.entries(spec.definitions || {})) {
  for (const [col, meta] of Object.entries(def.properties || {})) {
    if (meta.enum) {
      console.log(`${name}.${col}: [${meta.enum.map((v) => JSON.stringify(v)).join(", ")}]`);
    }
  }
}

console.log("\n=== ROW COUNTS ===\n");
const tables = [
  "facturas",
  "usuarios",
  "entregas",
  "envios",
  "legalizaciones",
  "gastos_grupos",
  "gastos_generales",
  "sesiones_bot",
];
for (const t of tables) {
  const r = await fetch(`${url}/rest/v1/${t}?select=id`, {
    headers: { ...h, Prefer: "count=exact", Range: "0-0" },
  });
  const range = r.headers.get("content-range") || "?";
  const total = range.split("/").pop();
  console.log(`${t.padEnd(20)} ${total}`);
}

console.log("\n=== SAMPLE usuarios (1 row) ===\n");
const us = await (
  await fetch(`${url}/rest/v1/usuarios?select=*&limit=1`, { headers: h })
).json();
console.log(JSON.stringify(us, null, 2));
