import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { formatCOP, parseCOPString } from "@/lib/format";
import {
  deleteLegalizacion,
  findLegalizacionByReporteId,
  firmarLegalizacionAdmin,
  updateLegalizacionEstado,
} from "@/lib/legalizaciones-supabase";
import { appPublicBaseUrl, escHtml, notificarCoordinadoresZona } from "@/lib/notificaciones";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "").toLowerCase();

  try {
    const body = (await req.json()) as {
      firmaAdmin?: string;
      pdfUrl?: string;
      estado?: string;
    };
    const estadoPatch = String(body.estado || "").trim();

    if (estadoPatch === "Enviado FX") {
      if (rol !== "coordinador" && rol !== "admin") {
        return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
      }
      const row = await findLegalizacionByReporteId(reportId);
      if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      const mine = String(session.user.responsable || session.user.name || "").trim();
      if (
        rol === "coordinador" &&
        (row.coordinador ?? "").toLowerCase() !== mine.toLowerCase()
      ) {
        return NextResponse.json(
          { error: "No puedes actualizar reportes de otro coordinador" },
          { status: 403 }
        );
      }
      const n = await updateLegalizacionEstado(reportId, "Enviado FX");
      if (n === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (rol !== "admin") {
      return NextResponse.json(
        { error: "Solo el administrador puede firmar el reporte" },
        { status: 403 }
      );
    }

    const firmaAdmin = String(body.firmaAdmin || "").trim().slice(0, 45000);
    const pdfUrl = String(body.pdfUrl || "").trim();
    if (!firmaAdmin || !pdfUrl) {
      return NextResponse.json(
        { error: "firmaAdmin y pdfUrl son obligatorios" },
        { status: 400 }
      );
    }

    const existing = await findLegalizacionByReporteId(reportId);
    if (!existing)
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await firmarLegalizacionAdmin(reportId, firmaAdmin, pdfUrl);

    const sectorReporte = existing.sector ?? "";
    const totalRaw = existing.total != null ? String(existing.total) : "0";
    const totalReporte =
      parseCOPString(totalRaw) ||
      Number(String(totalRaw).replace(/[^\d]/g, "")) ||
      0;
    const base = appPublicBaseUrl();
    const msgCoord = [
      `✅ <b>BIA Energy - MiCaja</b>`,
      ``,
      `Tu reporte fue <b>firmado y aprobado</b> por el administrador.`,
      ``,
      `<b>Total aprobado:</b> ${escHtml(formatCOP(totalReporte))}`,
      ``,
      `Descarga PDF: ${escHtml(`${base}/reporte`)}`,
    ].join("\n");
    void notificarCoordinadoresZona(sectorReporte, msgCoord).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("legalizaciones PATCH:", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const row = await findLegalizacionByReporteId(reportId);
    if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const estado = (row.estado ?? "").trim();
    const coord = (row.coordinador ?? "").trim();
    const mine = String(session.user.responsable || session.user.name || "").trim();

    if (rol === "coordinador") {
      if (coord !== mine) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      if (estado !== "Pendiente Admin") {
        return NextResponse.json(
          { error: "Solo se pueden eliminar reportes pendientes de firma del admin" },
          { status: 400 }
        );
      }
    }

    const ok = await deleteLegalizacion(reportId);
    if (!ok) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("legalizaciones DELETE:", e);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
