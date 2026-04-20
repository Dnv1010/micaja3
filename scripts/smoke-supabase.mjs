// Smoke test del cliente Supabase — verifica que select básico funciona.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error, count } = await sb
  .from("usuarios")
  .select("responsable, correo, rol, sector", { count: "exact" })
  .limit(3);
if (error) {
  console.error("ERROR", error);
  process.exit(1);
}
console.log(`count=${count}, sample=`, data);
