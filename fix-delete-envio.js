const fs = require("fs");

// === 1. Agregar DELETE al API de envios ===
const fa = "app/api/envios/route.ts";
let ca = fs.readFileSync(fa, "utf8");

// Agregar imports necesarios
if (!ca.includes("deleteSheetRow")) {
  ca = ca.replace(
    'import { quoteSheetTitleForRange, sheetValuesToRecords } from "@/lib/sheets-helpers";',
    'import { quoteSheetTitleForRange, sheetValuesToRecords, deleteSheetRow } from "@/lib/sheets-helpers";'
  );
}

// Agregar funcion DELETE al final
if (!ca.includes("export async function DELETE")) {
  ca += `

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { id?: string };
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

    assertSheetsConfigured();
    const sheets = getSheetsClient();
    const spreadsheetId = micajaSpreadsheetId();

    // Buscar y eliminar en Envio
    const envioRange = \`\${quoteSheetTitleForRange(SHEET_NAMES.ENVIO)}!A:F\`;
    const envioRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: envioRange });
    const envioRows = envioRes.data.values ?? [];
    let envioRowIdx = -1;
    for (let i = 1; i < envioRows.length; i++) {
      if (String(envioRows[i][0] || "").trim() === id) { envioRowIdx = i; break; }
    }

    if (envioRowIdx === -1) {
      return NextResponse.json({ error: "Envio no encontrado" }, { status: 404 });
    }

    // Obtener sheetId del tab Envio
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
    const envioSheet = meta.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAMES.ENVIO
    );
    const entregaSheet = meta.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAMES.ENTREGAS
    );

    // Eliminar fila de Envio
    if (envioSheet?.properties?.sheetId != null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: envioSheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: envioRowIdx,
                endIndex: envioRowIdx + 1,
              },
            },
          }],
        },
      });
    }

    // Buscar y eliminar en Entregas por ID_Envio
    if (entregaSheet?.properties?.sheetId != null) {
      const entregaRange = \`\${quoteSheetTitleForRange(SHEET_NAMES.ENTREGAS)}!A:H\`;
      const entregaRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: entregaRange });
      const entregaRows = entregaRes.data.values ?? [];
      // ID_Envio esta en columna C (indice 2)
      for (let i = entregaRows.length - 1; i >= 1; i--) {
        if (String(entregaRows[i][2] || "").trim() === id) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: entregaSheet.properties.sheetId,
                    dimension: "ROWS",
                    startIndex: i,
                    endIndex: i + 1,
                  },
                },
              }],
            },
          });
          break;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("envios DELETE:", e);
    return NextResponse.json({ ok: false, error: "No se pudo eliminar" }, { status: 500 });
  }
}
`;
}

fs.writeFileSync(fa, ca, "utf8");
console.log("API ok");

// === 2. Agregar boton eliminar en el cliente ===
const fc = "components/coordinador/envios-coordinador-client.tsx";
let cc = fs.readFileSync(fc, "utf8");

// Agregar estado de eliminacion
if (!cc.includes("deleting")) {
  cc = cc.replace(
    'const [imagenModal, setImagenModal] = useState<string | null>(null);',
    `const [imagenModal, setImagenModal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);`
  );

  // Agregar funcion eliminar
  cc = cc.replace(
    '  return (',
    `  async function eliminarEnvio(id: string) {
    if (!confirm("¿Eliminar este envío? Se eliminará también de la hoja de entregas.")) return;
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
  }

  return (`
  );

  // Agregar columna Acciones en header
  cc = cc.replace(
    '<TableHead>Teléfono</TableHead>\n                </TableRow>',
    '<TableHead>Teléfono</TableHead>\n                  <TableHead>Acciones</TableHead>\n                </TableRow>'
  );
  // Fallback con encoded chars
  cc = cc.replace(
    '<TableHead>Tel\u00e9fono</TableHead>\n                </TableRow>',
    '<TableHead>Tel\u00e9fono</TableHead>\n                  <TableHead>Acciones</TableHead>\n                </TableRow>'
  );

  // Agregar celda con boton eliminar despues de telefono
  cc = cc.replace(
    `<TableCell>{getCellCaseInsensitive(r, "Telefono") || "\u2014"}</TableCell>`,
    `<TableCell>{getCellCaseInsensitive(r, "Telefono") || "\u2014"}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => eliminarEnvio(String(getCellCaseInsensitive(r, "ID_Envio", "ID") || ""))}
                            disabled={deleting === String(getCellCaseInsensitive(r, "ID_Envio", "ID") || "")}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {deleting === String(getCellCaseInsensitive(r, "ID_Envio", "ID") || "") ? "..." : "Eliminar"}
                          </button>
                        </TableCell>`
  );

  // Actualizar colSpan de 5 a 6
  cc = cc.replace(/colSpan=\{5\}/g, "colSpan={6}");
}

fs.writeFileSync(fc, cc, "utf8");
console.log("Cliente ok");
