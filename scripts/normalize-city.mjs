/**
 * Normaliza la columna city en invoices (schema micaja):
 * - Elimina el departamento (todo lo que viene después de la coma, punto o guión)
 * - Corrige capitalización en valores que están todo en mayúsculas
 * - Usa UPDATE explícito por valor para máximo control
 *
 * Uso:
 *   node scripts/normalize-city.mjs          → muestra preview sin cambiar nada
 *   node scripts/normalize-city.mjs --apply  → aplica los cambios en la DB
 */

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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const h = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "Content-Profile": "micaja",
  "Accept-Profile": "micaja",
};

// Mapeo explícito: valor actual → valor normalizado
// Sólo incluye filas que realmente cambian.
const CITY_MAP = {
  "Santa Marta, Magdalena":              "Santa Marta",
  "Cartagena, Bolivar":                  "Cartagena",
  "Barranquilla, Atlantico":             "Barranquilla",
  "Rioacha, guajira":                    "Riohacha",
  "Baranoa, Atlantico":                  "Baranoa",
  "Sincelejo, Sucre":                    "Sincelejo",
  "Sabanagrande. Atlantico":             "Sabanagrande",
  "Maria la baja, Bolivar":              "Maria La Baja",
  "Puerto colombia , Atlántico":         "Puerto Colombia",
  "Magangue, Bolívar":                   "Magangue",
  "Monteria, Cordoba":                   "Monteria",
  "Fundacion, Magdalena":                "Fundacion",
  "Galapa,Atlántico":                    "Galapa",
  "Calamar,  bolivar":                   "Calamar",
  "SAMACA":                              "Samaca",
  "Plato , magdalena":                   "Plato",
  "Santiago de Tolu, Sucre":             "Santiago de Tolu",
  "Cienaga de oro, Cordoba":             "Cienaga de Oro",
  "Sabanalarga, Atlantico":              "Sabanalarga",
  "Malambo, Atlantico":                  "Malambo",
  "El Carmen de bolivar":                "El Carmen de Bolivar",
  "GUADUAS":                             "Guaduas",
  "NOCAIMA":                             "Nocaima",
  "LEBRIJA":                             "Lebrija",
  "Coveñas-sucre":                       "Coveñas",
  "CHIA":                                "Chia",
  "Suan , Atlántico":                    "Suan",
  "Valledupar, cesar":                   "Valledupar",
};

// Valores que no cambian (ya están bien):
// "Bogota DC", "Bogotá", "Mompox", "Bodega Bia Baq..."

const applyMode = process.argv.includes("--apply");

console.log("=== PREVIEW: normalización de city en invoices ===\n");
console.log(`Modo: ${applyMode ? "APPLY (escribiendo en DB)" : "DRY-RUN (solo preview)"}\n`);

console.log(`  NULL → ""\n`);
for (const [from, to] of Object.entries(CITY_MAP)) {
  console.log(`  "${from}"\n    → "${to}"\n`);
}

if (!applyMode) {
  console.log("\nEjecuta con --apply para aplicar los cambios:");
  console.log("  node scripts/normalize-city.mjs --apply\n");
  process.exit(0);
}

console.log("\nAplicando cambios...\n");

let ok = 0;
let errors = 0;

// 1. Convertir NULL → ""
const nullRes = await fetch(`${url}/rest/v1/invoices?city=is.null`, {
  method: "PATCH",
  headers: { ...h, Prefer: "count=exact" },
  body: JSON.stringify({ city: "" }),
});
if (nullRes.ok) {
  const count = nullRes.headers.get("content-range") || "?";
  console.log(`  ✓ NULL → ""  (${count})`);
  ok++;
} else {
  const body = await nullRes.text();
  console.error(`  ✗ NULL: ${nullRes.status} ${body}`);
  errors++;
}

// 2. Mapeo valor-a-valor
for (const [from, to] of Object.entries(CITY_MAP)) {
  const encodedFrom = encodeURIComponent(`eq.${from}`);
  const res = await fetch(`${url}/rest/v1/invoices?city=${encodedFrom}`, {
    method: "PATCH",
    headers: { ...h, Prefer: "count=exact" },
    body: JSON.stringify({ city: to }),
  });

  if (res.ok) {
    const count = res.headers.get("content-range") || "?";
    console.log(`  ✓ "${from}" → "${to}"  (${count})`);
    ok++;
  } else {
    const body = await res.text();
    console.error(`  ✗ "${from}": ${res.status} ${body}`);
    errors++;
  }
}

console.log(`\nListo: ${ok} actualizados, ${errors} errores.`);
