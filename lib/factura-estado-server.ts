import { findFacturaById, updateFacturaEstado } from "@/lib/facturas-supabase";

/** Actualiza estado (Legalizado/Verificado/Estado) de una factura por ID. */
export async function applyFacturaEstadoById(
  id: string,
  estado: string,
  motivoRechazo = ""
): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await findFacturaById(id);
  if (!found) return { ok: false, error: "not_found" };
  await updateFacturaEstado(id, estado, motivoRechazo || undefined);
  return { ok: true };
}
