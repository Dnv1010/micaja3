/**
 * Auditor determinístico de facturas para Mi Caja.
 * Reglas de negocio: topes por categoría, duplicados, coherencia por día/persona.
 */

export type AuditoriaCategoria = "desayuno" | "almuerzo" | "cena" | "hospedaje" | "otro";

export type AuditoriaEstado = "OK" | "EXCEDIDO" | "DUPLICADO";

export interface FacturaAuditar {
  idFactura: string;
  numFactura?: string;
  nit?: string;
  proveedor?: string;
  concepto?: string;
  tipoServicio?: string;
  responsable?: string;
  fecha?: string; // YYYY-MM-DD o DD/MM/YYYY
  valor: number;
  categoria?: AuditoriaCategoria; // opcional; si no viene, se infiere
}

export interface AuditoriaItem {
  idFactura: string;
  categoria: AuditoriaCategoria;
  tope: number | null;
  estado: AuditoriaEstado;
  diferencia: number;
  alertas: string[];
}

export interface AuditoriaResultado {
  items: AuditoriaItem[];
  totales: { ok: number; excedidos: number; duplicados: number; alertasCoherencia: number };
}

export const TOPES_COP: Record<AuditoriaCategoria, number | null> = {
  desayuno: 20000,
  almuerzo: 25000,
  cena: 20000,
  hospedaje: 70000,
  otro: null,
};

const PALABRAS_CATEGORIA: Array<{ cat: AuditoriaCategoria; rx: RegExp }> = [
  { cat: "desayuno", rx: /\bdesayun/i },
  { cat: "almuerzo", rx: /\balmuerz|almuerzo|corrientazo|ejecutivo del dia|ejecutivo\s+dia/i },
  { cat: "cena", rx: /\bcena|comid[ao] noche/i },
  { cat: "hospedaje", rx: /\bhospedaje|hotel|hostal|alojamiento|habitaci[oó]n|noche\s+hotel/i },
];

export function inferirCategoria(f: FacturaAuditar): AuditoriaCategoria {
  if (f.categoria) return f.categoria;
  const txt = `${f.concepto ?? ""} ${f.tipoServicio ?? ""} ${f.proveedor ?? ""}`.toLowerCase();
  for (const { cat, rx } of PALABRAS_CATEGORIA) if (rx.test(txt)) return cat;
  return "otro";
}

function normFecha(raw: string | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let y = +dmy[3];
    if (y < 100) y += 2000;
    return `${y}-${String(+dmy[2]).padStart(2, "0")}-${String(+dmy[1]).padStart(2, "0")}`;
  }
  return s;
}

function claveDuplicado(f: FacturaAuditar): string {
  const num = (f.numFactura ?? "").trim().toLowerCase();
  const nit = (f.nit ?? "").replace(/[^\d]/g, "");
  const val = Math.round(f.valor);
  return `${num}|${nit}|${val}`;
}

/**
 * Ejecuta la auditoría determinística sobre un conjunto de facturas.
 * Los duplicados se detectan tanto dentro del conjunto como contra `historicas` opcionales.
 */
export function auditarFacturas(
  facturas: FacturaAuditar[],
  opciones?: { historicas?: FacturaAuditar[] }
): AuditoriaResultado {
  const items: AuditoriaItem[] = [];
  const vistasDupe = new Set<string>();
  for (const h of opciones?.historicas ?? []) {
    if (h.numFactura && (h.nit || h.valor)) vistasDupe.add(claveDuplicado(h));
  }

  // mapa responsable+fecha+categoria → count (coherencia)
  const coherenciaMap = new Map<string, number>();

  let okCount = 0;
  let excedidosCount = 0;
  let duplicadosCount = 0;
  let alertasCoherenciaCount = 0;

  for (const f of facturas) {
    const categoria = inferirCategoria(f);
    const tope = TOPES_COP[categoria];
    const alertas: string[] = [];
    let estado: AuditoriaEstado = "OK";
    let diferencia = 0;

    // duplicado
    const claveDup = claveDuplicado(f);
    if (f.numFactura && (f.nit || f.valor) && vistasDupe.has(claveDup)) {
      estado = "DUPLICADO";
      duplicadosCount++;
    } else {
      if (f.numFactura && (f.nit || f.valor)) vistasDupe.add(claveDup);

      // topes
      if (tope != null && f.valor > tope) {
        estado = "EXCEDIDO";
        diferencia = Math.round(f.valor - tope);
        excedidosCount++;
      } else {
        okCount++;
      }
    }

    // coherencia (solo comidas): mismo responsable + fecha + categoria comida > 1
    if (categoria === "desayuno" || categoria === "almuerzo" || categoria === "cena") {
      const resp = (f.responsable ?? "").trim().toLowerCase();
      const dia = normFecha(f.fecha);
      if (resp && dia) {
        const key = `${resp}|${dia}|${categoria}`;
        const prev = coherenciaMap.get(key) ?? 0;
        if (prev > 0) {
          const ordinal = prev + 1;
          alertas.push(`Segundo ${categoria} registrado para ${f.responsable ?? "el mismo responsable"} el ${dia} (#${ordinal})`);
          alertasCoherenciaCount++;
        }
        coherenciaMap.set(key, prev + 1);
      }
    }

    items.push({
      idFactura: f.idFactura,
      categoria,
      tope,
      estado,
      diferencia,
      alertas,
    });
  }

  return {
    items,
    totales: {
      ok: okCount,
      excedidos: excedidosCount,
      duplicados: duplicadosCount,
      alertasCoherencia: alertasCoherenciaCount,
    },
  };
}
