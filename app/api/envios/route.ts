import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { parseSheetDate, formatCOP } from "@/lib/format";
import { TABLES } from "@/lib/db-tables";
import { sectorsEquivalent, normalizeSector } from "@/lib/sector-normalize";
import { appPublicBaseUrl, escHtml, notificarUsuario } from "@/lib/notificaciones";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";

type EnvioDb = {
  transfer_id: string | null;
  fecha: string | null;
  assignee: string | null;
  amount: number | string | null;
  region: string | null;
  voucher_number: string | null;
  observacion: string | null;
};

function envioDbToApi(r: EnvioDb): Record<string, string> {
  return {
    IDEnvio: r.transfer_id ?? "",
    ID: r.transfer_id ?? "",
    Fecha: r.fecha ?? "",
    Monto: r.amount != null ? String(r.amount) : "",
    Responsable: r.assignee ?? "",
    Comprobante: r.voucher_number ?? "",
    Sector: r.region ?? "",
    Observacion: r.observacion ?? "",
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") return NextResponse.json({ data: [] });

  try {
    const { searchParams } = new URL(req.url);
    const sectorQ = searchParams.get("sector")?.trim() || "";
    const responsableQ = searchParams.get("responsable")?.trim().toLowerCase() || "";
    const desde = parseSheetDate(searchParams.get("desde") || "");
    const hasta = parseSheetDate(searchParams.get("hasta") || "");

    let zonaSet: Set<string> | null = null;
    if (sectorQ) {
      if (rol === "admin") zonaSet = await responsablesEnZonaSheetSet(sectorQ);
      else if (
        rol === "coordinador" &&
        sectorsEquivalent(String(session.user.sector || ""), sectorQ)
      )
        zonaSet = await responsablesEnZonaSheetSet(sectorQ);
      else return NextResponse.json({ data: [] });
    }

    const { data: rows, error } = await getSupabase()
      .from(TABLES.transfers)
      .select("transfer_id, fecha, assignee, amount, region, voucher_number, observacion, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;

    let data = ((rows ?? []) as EnvioDb[]).map(envioDbToApi);

    data = data.filter((r) => {
      const resp = r.Responsable.toLowerCase();
      const fecha = parseSheetDate(r.Fecha);
      if (zonaSet && !zonaSet.has(resp)) return false;
      if (responsableQ && resp !== responsableQ) return false;
      if (desde && (!fecha || fecha < desde)) return false;
      if (hasta && (!fecha || fecha > hasta)) return false;
      return true;
    });

    data.reverse();
    return NextResponse.json({ data });
  } catch (e) {
    console.error("envios GET:", e);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      responsable?: string;
      monto?: string | number;
      fecha?: string;
      comprobante?: string;
      telefono?: string;
      sector?: string;
      observacion?: string;
    };
    const responsable = String(body.responsable || "").trim();
    const fechaRaw = String(body.fecha || "").trim();
    // Normalize to YYYY-MM-DD for DB (accepts DD/MM/YYYY or YYYY-MM-DD)
    const fecha = (() => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) return fechaRaw;
      const m = fechaRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      return fechaRaw;
    })();
    const comprobante = String(body.comprobante ?? "").trim();

    const montoNum =
      typeof body.monto === "number" && Number.isFinite(body.monto)
        ? Math.max(0, Math.round(body.monto))
        : Number(String(body.monto ?? "").replace(/[^\d]/g, ""));

    if (!responsable || !fecha || !montoNum) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: responsable, monto, fecha" },
        { status: 400 }
      );
    }

    if (rol === "coordinador") {
      const set = await responsablesEnZonaSheetSet(String(session.user.sector || ""));
      const yo = String(session.user.responsable || session.user.name || "")
        .trim()
        .toLowerCase();
      if (yo) set.add(yo);
      if (!set.has(responsable.toLowerCase())) {
        return NextResponse.json({ error: "Usuario fuera de su zona" }, { status: 403 });
      }
      const limite = limiteAprobacionZona(String(session.user.sector || ""));
      if (montoNum > limite) {
        return NextResponse.json(
          {
            error: `El monto excede el límite de la zona (${limite.toLocaleString("es-CO")})`,
          },
          { status: 400 }
        );
      }
    }

    const ts = Date.now();
    const id = `ENV-${ts}`;
    const idEntrega = `ENT-${ts}`;
    const sectorCanon =
      normalizeSector(String(body.sector ?? session.user.sector ?? "")) || "Bogota";

    const sb = getSupabase();
    const { error: envErr } = await sb.from(TABLES.transfers).insert({
      transfer_id: id,
      fecha,
      assignee: responsable,
      amount: montoNum,
      region: sectorCanon,
      voucher_number: comprobante || null,
      observacion: String(body.observacion ?? "").trim() || null,
    });
    if (envErr) throw envErr;

    const { error: entErr } = await sb.from(TABLES.deliveries).insert({
      delivery_id: idEntrega,
      delivery_date: fecha,
      transfer_id: id,
      assignee: responsable,
      delivered_amount: montoNum,
    });
    if (entErr) {
      // Entrega failed — roll back the envio to avoid orphan records
      await sb.from(TABLES.transfers).delete().eq("transfer_id", id);
      throw entErr;
    }

    const coord = String(session.user.responsable || session.user.name || "").trim();
    const base = appPublicBaseUrl();
    const msg = [
      `💸 <b>BIA Energy - MiCaja</b>`,
      ``,
      `Hola ${escHtml(responsable)}, tu coordinador <b>${escHtml(coord)}</b> te envió <b>${escHtml(formatCOP(montoNum))}</b> el ${escHtml(fechaRaw || fecha)}.`,
      ``,
      `Revisa tu saldo: ${escHtml(base)}`,
    ].join("\n");
    const notificado = await notificarUsuario(responsable, msg).catch(() => false);

    return NextResponse.json({ ok: true, id, notificado });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
    console.error("envios POST:", msg, e);
    return NextResponse.json(
      { ok: false, error: `Error al registrar: ${msg}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { id?: string };
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

    const sb = getSupabase();
    const { data: existing, error: selErr } = await sb
      .from(TABLES.transfers)
      .select("id, transfer_id, assignee")
      .eq("transfer_id", id)
      .limit(1);
    if (selErr) throw selErr;
    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: "Envio no encontrado" }, { status: 404 });
    }

    if (rol === "coordinador") {
      const respEnvio = String((existing[0] as { assignee?: string }).assignee || "").trim().toLowerCase();
      const set = await responsablesEnZonaSheetSet(String(session.user.sector || ""));
      const yo = String(session.user.responsable || session.user.name || "")
        .trim()
        .toLowerCase();
      if (yo) set.add(yo);
      if (!respEnvio || !set.has(respEnvio)) {
        return NextResponse.json({ error: "Envio fuera de su zona" }, { status: 403 });
      }
    }

    const { error: delEnt } = await sb.from(TABLES.deliveries).delete().eq("transfer_id", id);
    if (delEnt) throw delEnt;

    const { error: delEnv } = await sb.from(TABLES.transfers).delete().eq("transfer_id", id);
    if (delEnv) throw delEnv;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("envios DELETE:", e);
    return NextResponse.json(
      { ok: false, error: "No se pudo eliminar" },
      { status: 500 }
    );
  }
}
