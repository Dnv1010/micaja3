const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Mostrar que prompt tiene actualmente
const idx = c.indexOf("{ text:");
if (idx !== -1) {
  const snippet = c.substring(idx, idx + 300);
  console.log("PROMPT ACTUAL (primeros 300 chars):");
  console.log(snippet);
} else {
  console.log("NO ENCONTRE { text:");
}

// Verificar si Gemini se ejecuta o si el catch lo mata
const catchIdx = c.indexOf("} catch (gemErr)");
const catchIdx2 = c.indexOf("} catch {", c.indexOf("parseGeminiJson"));
console.log("\ncatch con log:", catchIdx !== -1);
console.log("catch sin log:", catchIdx2 !== -1);
