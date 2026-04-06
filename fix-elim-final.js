const fs = require("fs");
const fc = "components/coordinador/envios-coordinador-client.tsx";
let c = fs.readFileSync(fc, "utf8");

// Insertar funcion justo antes del return principal
c = c.replace(
  '  return (\n    <div className="space-y-6">',
  `  async function eliminarEnvio(id: string) {
    if (!confirm("Eliminar este envio? Se eliminara tambien de la hoja de entregas.")) return;
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

  return (
    <div className="space-y-6">`
);

fs.writeFileSync(fc, c, "utf8");
console.log("tiene eliminarEnvio:", c.includes("async function eliminarEnvio"));
console.log("antes del return:", c.indexOf("eliminarEnvio") < c.indexOf("return ("));
