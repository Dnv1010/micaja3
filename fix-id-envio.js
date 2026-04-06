const fs = require("fs");
const fc = "components/coordinador/envios-coordinador-client.tsx";
let c = fs.readFileSync(fc, "utf8");

// Cambiar para que use la primera key del record como ID
c = c.replace(
  /onClick=\{\(\) => eliminarEnvio\(String\(getCellCaseInsensitive\(r, "ID_Envio", "ID"\) \|\| ""\)\)\}/g,
  'onClick={() => eliminarEnvio(String(Object.values(r)[0] || ""))}'
);
c = c.replace(
  /disabled=\{deleting === String\(getCellCaseInsensitive\(r, "ID_Envio", "ID"\) \|\| ""\)\}/g,
  'disabled={deleting === String(Object.values(r)[0] || "")}'
);
c = c.replace(
  /\{deleting === String\(getCellCaseInsensitive\(r, "ID_Envio", "ID"\) \|\| ""\) \? "\.\.\." : "Eliminar"\}/g,
  '{deleting === String(Object.values(r)[0] || "") ? "..." : "Eliminar"}'
);

fs.writeFileSync(fc, c, "utf8");
console.log("ok:", !c.includes("ID_Envio"));
