const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Quitar response_mime_type que no funciona en free tier
c = c.replace(
  'generationConfig: { temperature: 0.1, maxOutputTokens: 1024, response_mime_type: "application/json" },',
  'generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },'
);

// Agregar limpieza de JSON y log de error en el catch
c = c.replace(
  `          if (geminiText) {
            datos = parseGeminiJson(geminiText);
          }
        } catch {
          datos = null;
        }`,
  `          if (geminiText) {
            // Limpiar markdown si Gemini lo envuelve en backticks
            const cleanJson = geminiText.replace(/\`\`\`json\\n?/g, "").replace(/\`\`\`/g, "").trim();
            datos = parseGeminiJson(cleanJson);
            console.log("[gemini] OK:", JSON.stringify(datos).slice(0, 200));
          }
        } catch (gemErr) {
          console.error("[gemini] Error:", gemErr);
          datos = null;
        }`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok:", !c.includes("response_mime_type"));
console.log("ok:", c.includes("[gemini] OK:"));
