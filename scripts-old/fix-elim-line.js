const fs = require("fs");
const fc = "components/coordinador/envios-coordinador-client.tsx";
let c = fs.readFileSync(fc, "utf8");
const lines = c.split("\n");

// Encontrar la linea con "return (" que es el return principal del componente
// Debe ser la que esta despues de enviarDinero
let insertIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === "return (") {
    insertIdx = i;
    break;
  }
}

if (insertIdx === -1) {
  console.log("ERROR: no encontre return (");
  process.exit(1);
}

const func = `
  async function eliminarEnvio(id: string) {
    if (!confirm("Eliminar este envio?")) return;
    setDeleting(id);
    try {
      const res = await fetch("/api/envios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        void cargarLista();
      } else {
        const j = (await res.json().catch(() => ({}))) as Record<string, string>;
        alert(String(j.error || "No se pudo eliminar"));
      }
    } catch {
      alert("Error al eliminar");
    } finally {
      setDeleting(null);
    }
  }
`;

lines.splice(insertIdx, 0, func);
c = lines.join("\n");

fs.writeFileSync(fc, c, "utf8");
console.log("ok:", c.includes("async function eliminarEnvio"));
console.log("linea insertada antes de:", insertIdx);
