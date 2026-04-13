const fs = require("fs");
const fc = "components/coordinador/envios-coordinador-client.tsx";
let c = fs.readFileSync(fc, "utf8");

// Quitar la funcion de donde esta mal ubicada
const funcStr = `  async function eliminarEnvio(id: string) {
    if (!confirm("\u00bfEliminar este env\u00edo? Se eliminar\u00e1 tambi\u00e9n de la hoja de entregas.")) return;
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
        const j = await res.json().catch(() => ({}));
        alert(String((j as Record<string,string>).error || "No se pudo eliminar"));
      }
    } catch {
      alert("Error al eliminar");
    } finally {
      setDeleting(null);
    }
  }`;

// Quitar donde esta
c = c.replace(funcStr + "\n\n  return (", "  return (");
c = c.replace(funcStr + "\n  return (", "  return (");
c = c.replace(funcStr + "\r\n\r\n  return (", "  return (");

// Si aun esta, quitar con regex
if (c.includes("async function eliminarEnvio")) {
  c = c.replace(/\s*async function eliminarEnvio\(id: string\) \{[\s\S]*?\n  \}\n/, "\n");
}

// Insertar justo antes del return principal del componente (linea con solo "  return (")
const mainReturn = "\n  return (\n    <div className=\"space-y-6\">";
c = c.replace(mainReturn, "\n" + funcStr + "\n" + mainReturn);

fs.writeFileSync(fc, c, "utf8");

// Verificar
const lines = c.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("eliminarEnvio") && !lines[i].includes("onClick")) {
    console.log("eliminarEnvio en linea:", i + 1);
  }
}
console.log("ok");
