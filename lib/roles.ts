import type { UsuarioRow, FacturaRow, EntregaRow, LegalizacionRow, EnvioRow } from "@/types/models";

export const HERNAN_EMAIL = "hernan.manjarres@bia.app";

export interface SessionCtx {
  email: string;
  rol: string;
  responsable: string;
  area: string;
  sector: string;
}

function normRol(r: string): string {
  return (r || "").toLowerCase();
}

function isActive(u: UsuarioRow): boolean {
  const v = (u.UserActive || "").toUpperCase();
  return v === "TRUE" || v === "SI" || v === "SÍ";
}

export function usuarioMatchesCoordinadorZona(u: UsuarioRow, ctx: SessionCtx): boolean {
  if (normRol(ctx.rol) !== "coordinador") return true;
  const sector = (ctx.sector || "").toLowerCase();
  if (sector.includes("bogota")) {
    return (u.Sector || "").toLowerCase().includes("bogota");
  }
  if (sector.includes("costa")) {
    const a = u.Area || "";
    return a.includes("Barranquilla") || a.includes("Cartagena");
  }
  return true;
}

export function filterUsuariosByVisibility(usuarios: UsuarioRow[], ctx: SessionCtx): UsuarioRow[] {
  const r = normRol(ctx.rol);
  if (r === "admin" || r === "verificador") {
    return usuarios.filter(isActive);
  }
  if (r === "coordinador") {
    return usuarios.filter((u) => isActive(u) && usuarioMatchesCoordinadorZona(u, ctx));
  }
  return usuarios.filter(
    (u) => u.Correos?.toLowerCase() === ctx.email.toLowerCase()
  );
}

export function filterEntregasWithUsuarios(
  rows: EntregaRow[],
  ctx: SessionCtx,
  usuarios: UsuarioRow[]
): EntregaRow[] {
  const r = normRol(ctx.rol);
  const byName = new Map(usuarios.map((u) => [u.Responsable, u] as const));
  if (r === "admin" || r === "verificador") return rows;
  if (r === "coordinador") {
    return rows.filter((e) => {
      const u = byName.get(e.Responsable || "");
      if (!u) return false;
      return usuarioMatchesCoordinadorZona(u, ctx);
    });
  }
  return rows.filter((e) => {
    const u = byName.get(e.Responsable || "");
    return u?.Correos?.toLowerCase() === ctx.email.toLowerCase();
  });
}

export function filterFacturas(rows: FacturaRow[], ctx: SessionCtx, usuarios: UsuarioRow[]): FacturaRow[] {
  const r = normRol(ctx.rol);
  const byName = new Map(usuarios.map((u) => [u.Responsable, u] as const));
  if (r === "admin" || r === "verificador") return rows;
  if (r === "coordinador") {
    return rows.filter((f) => {
      const u = byName.get(f.Responsable || "");
      if (!u) return false;
      return usuarioMatchesCoordinadorZona(u, ctx);
    });
  }
  return rows.filter((f) => f.Responsable === ctx.responsable);
}

export function filterLegalizaciones(
  rows: LegalizacionRow[],
  ctx: SessionCtx,
  usuarios: UsuarioRow[]
): LegalizacionRow[] {
  const r = normRol(ctx.rol);
  const byName = new Map(usuarios.map((u) => [u.Responsable, u] as const));
  if (r === "admin" || r === "verificador") return rows;
  if (r === "coordinador") {
    return rows.filter((l) => {
      const u = byName.get(l.Responsable || "");
      if (!u) return false;
      return usuarioMatchesCoordinadorZona(u, ctx);
    });
  }
  return rows.filter((l) => l.Responsable === ctx.responsable);
}

export function filterEnvios(rows: EnvioRow[], ctx: SessionCtx, usuarios: UsuarioRow[]): EnvioRow[] {
  const r = normRol(ctx.rol);
  if (r !== "admin" && r !== "coordinador") return [];
  if (r === "admin") return rows;
  const byName = new Map(usuarios.map((u) => [u.Responsable, u] as const));
  return rows.filter((e) => {
    const u = byName.get(e.Responsable || "");
    if (!u) return false;
    return usuarioMatchesCoordinadorZona(u, ctx);
  });
}

export function coordinadorAssignableUsers(usuarios: UsuarioRow[], ctx: SessionCtx): UsuarioRow[] {
  return usuarios.filter((u) => isActive(u) && usuarioMatchesCoordinadorZona(u, ctx));
}

export function canManageUsers(email: string): boolean {
  return email.toLowerCase() === HERNAN_EMAIL;
}

export function canEditVerificado(rol: string): boolean {
  return normRol(rol) === "admin";
}
