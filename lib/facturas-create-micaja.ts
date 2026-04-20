import type { Session } from "next-auth";
import { evaluarAutoAprobacion } from "@/lib/auto-aprobacion";
import { validateFacturaNegocio, type FacturaMutateFields } from "@/lib/factura-mutate-validation";
import { parseCOPString } from "@/lib/format";
import {
  findFacturaDuplicadaPorNitNumResponsable,
  estadoFacturaDuplicadaMensaje,
} from "@/lib/factura-duplicada-micaja";
import { insertFactura, loadFacturas } from "@/lib/facturas-supabase";
import { normalizeSector } from "@/lib/sector-normalize";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";

export type FacturaCreateBody = {
  fecha?: string;
  proveedor?: string;
  nit?: string;
  numFactura?: string;
  concepto?: string;
  valor?: string;
  tipoFactura?: string;
  servicioDeclarado?: string;
  tipoOperacion?: string;
  aNombreBia?: boolean;
  ciudad?: string;
  responsable?: string;
  area?: string;
  sector?: string;
  imagenUrl?: string;
  driveFileId?: string;
};

export type CrearFacturaResult =
  | { ok: true; id: string; estadoInicial: string }
  | { ok: false; status: number; error: string; duplicada?: boolean };

type AuthMode =
  | { kind: "session"; session: Session }
  | { kind: "internal" };

export async function crearFacturaMicaja(
  body: FacturaCreateBody,
  auth: AuthMode
): Promise<CrearFacturaResult> {
  const imagenUrl = String(body.imagenUrl || "").trim();
  if (!imagenUrl) {
    return {
      ok: false,
      status: 400,
      error: "La factura debe incluir la imagen en Drive (imagenUrl)",
    };
  }

  const fecha = String(body.fecha || "").trim();
  const proveedor = String(body.proveedor || "").trim();
  const concepto = String(body.concepto || "").trim();
  const tipoFactura = String(body.tipoFactura || "").trim();
  const servicioDeclarado = String(body.servicioDeclarado || "").trim();
  const tipoOperacion = String(body.tipoOperacion || "").trim();
  const ciudad = String(body.ciudad || "").trim();
  const sector = String(body.sector || "").trim();
  const nit = String(body.nit || "").trim();
  const numFactura = String(body.numFactura || "").trim();
  const aNombreBia = Boolean(body.aNombreBia);
  const valorNum = parseCOPString(String(body.valor || "0"));

  const mutate: FacturaMutateFields = {
    fecha,
    proveedor,
    concepto,
    tipoFactura,
    servicioDeclarado,
    tipoOperacion,
    ciudad,
    sector,
    nit,
    // Bot (internal) tolera valor 0 porque OCR puede fallar y el usuario editará
    // en la app. Flujo session (upload manual en UI) sigue exigiendo valor > 0.
    valorRaw: auth.kind === "internal" && valorNum <= 0 ? "1" : String(body.valor || "0"),
    aNombreBia,
  };
  const vErr = validateFacturaNegocio(mutate);
  if (vErr) {
    return { ok: false, status: 400, error: vErr };
  }

  let responsable = "";
  if (auth.kind === "session") {
    const s = auth.session;
    const rolPost = String(s.user?.rol || "user").toLowerCase();
    if (rolPost !== "user" && rolPost !== "coordinador" && rolPost !== "admin") {
      return { ok: false, status: 403, error: "Sin permiso" };
    }
    responsable = String(body.responsable || s.user?.responsable || "").trim();
    if (!responsable) {
      return { ok: false, status: 400, error: "Falta responsable" };
    }
    if (rolPost === "coordinador") {
      const setZ = await responsablesEnZonaSheetSet(String(s.user?.sector || ""));
      const mine = String(s.user?.responsable || "").trim().toLowerCase();
      if (responsable.toLowerCase() !== mine && !setZ.has(responsable.toLowerCase())) {
        return { ok: false, status: 403, error: "Responsable fuera de su zona" };
      }
    }
  } else {
    responsable = String(body.responsable || "").trim();
    if (!responsable) {
      return { ok: false, status: 400, error: "Falta responsable" };
    }
  }

  const facturas = await loadFacturas();

  if (nit && numFactura) {
    const duplicada = findFacturaDuplicadaPorNitNumResponsable(facturas, {
      nit,
      numFactura,
      responsable,
    });
    if (duplicada) {
      const estadoDup = estadoFacturaDuplicadaMensaje(duplicada);
      return {
        ok: false,
        status: 409,
        error: `Esta factura ya fue registrada anteriormente (Estado: ${estadoDup}). No se puede registrar de nuevo.`,
        duplicada: true,
      };
    }
  }

  const facturaParaEvaluar: Record<string, unknown> = {
    Nit_Factura: nit,
    Num_Factura: numFactura,
    Adjuntar_Factura: imagenUrl,
    ImagenURL: imagenUrl,
    Nombre_bia: aNombreBia ? "TRUE" : "FALSE",
    Tipo_servicio: servicioDeclarado,
    Monto_Factura: String(Math.round(valorNum)),
    Responsable: responsable,
    Fecha_Factura: fecha,
  };

  const resultado = evaluarAutoAprobacion(facturaParaEvaluar, facturas);
  const estadoInicial = resultado.aprobar ? "Aprobada" : "Pendiente";
  const observacionFinal = resultado.aprobar
    ? `${concepto.trim() ? `${concepto.trim()} · ` : ""}[AUTO] ${resultado.motivo}`
    : concepto;

  console.log(`[auto-aprobacion] ${responsable}: ${resultado.motivo}`);

  const id = String(Date.now());
  const sessionSector =
    auth.kind === "session" ? String(auth.session.user?.sector || "") : sector;
  const sectorFinal =
    normalizeSector(sector || sessionSector) ?? (sector || sessionSector || "Bogota");

  await insertFactura({
    idFactura: id,
    numFactura,
    fecha,
    valor: Math.round(valorNum),
    responsable,
    servicioDeclarado,
    tipoFactura,
    nit,
    proveedor,
    aNombreBia,
    concepto: observacionFinal,
    observacion: observacionFinal,
    imagenUrl,
    driveFileId: String(body.driveFileId || "").trim() || undefined,
    ciudad,
    sector: sectorFinal,
    tipoOperacion,
    estado: estadoInicial,
  });

  return { ok: true, id, estadoInicial };
}
