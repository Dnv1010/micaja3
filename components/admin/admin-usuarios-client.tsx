"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BiaAlert } from "@/components/ui/bia-alert";
import { BiaConfirm } from "@/components/ui/bia-confirm";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { SIN_FILTRO } from "@/lib/filter-select";
import { formatCOP } from "@/lib/format";
import {
  isUserActiveInSheet,
  usuarioSheetEmail,
  usuarioSheetUserActiveRaw,
} from "@/lib/usuario-sheet-fields";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type BalanceApi = {
  responsable: string;
  totalRecibido: number;
  totalGastado: number;
  balance: number;
};

type ModalMode = "agregar" | "editar" | null;

type UsuarioForm = {
  email: string;
  responsable: string;
  cargo: string;
  rol: "user" | "coordinador" | "admin";
  sector: string;
  area: string;
  cedula: string;
  telefono: string;
  userActive: boolean;
  pin: string;
};

function emptyForm(): UsuarioForm {
  return {
    email: "",
    responsable: "",
    cargo: "",
    rol: "user",
    sector: "Bogota",
    area: "",
    cedula: "",
    telefono: "",
    userActive: true,
    pin: "1234",
  };
}

function balanceMapFromApi(rows: BalanceApi[]): Map<string, BalanceApi> {
  const m = new Map<string, BalanceApi>();
  for (const r of rows) {
    m.set(r.responsable.trim().toLowerCase(), r);
  }
  return m;
}

function balanceForResponsable(m: Map<string, BalanceApi>, responsable: string): BalanceApi {
  const k = responsable.trim().toLowerCase();
  return (
    m.get(k) || {
      responsable,
      totalRecibido: 0,
      totalGastado: 0,
      balance: 0,
    }
  );
}

function recordToDisplayRow(rec: Record<string, unknown>): {
  email: string;
  responsable: string;
  cargo: string;
  rol: string;
  sector: string;
  area: string;
  cedula: string;
  telefono: string;
} {
  const rolRaw = String(getCellCaseInsensitive(rec, "Rol") || "user").toLowerCase();
  const rol =
    rolRaw === "admin" || rolRaw === "coordinador" ? rolRaw : "user";
  return {
    email: usuarioSheetEmail(rec),
    responsable: String(getCellCaseInsensitive(rec, "Responsable") || "").trim(),
    cargo: String(getCellCaseInsensitive(rec, "Cargo") || "").trim(),
    rol,
    sector: String(getCellCaseInsensitive(rec, "Sector") || "Bogota").trim(),
    area: String(getCellCaseInsensitive(rec, "Area") || "").trim(),
    cedula: String(getCellCaseInsensitive(rec, "Cedula", "Cédula") || "").trim(),
    telefono: String(getCellCaseInsensitive(rec, "Telefono", "Teléfono") || "").trim(),
  };
}

export function AdminUsuariosClient() {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceApi[]>([]);
  const [usuariosRecords, setUsuariosRecords] = useState<Record<string, unknown>[]>([]);
  const [activeFromSheet, setActiveFromSheet] = useState<Map<string, boolean>>(new Map());
  const [filtroZona, setFiltroZona] = useState("");
  const [filtroRol, setFiltroRol] = useState("");

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<UsuarioForm>(emptyForm());
  const [emailOriginal, setEmailOriginal] = useState("");

  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null);
  const [biaMessage, setBiaMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, uRes] = await Promise.all([
        fetch("/api/balance"),
        fetch("/api/usuarios?todos=true"),
      ]);
      const bJson = await bRes.json().catch(() => ({ data: [] }));
      const uJson = await uRes.json().catch(() => ({ data: [] }));
      setBalances(Array.isArray(bJson.data) ? bJson.data : []);
      const rows = Array.isArray(uJson.data) ? uJson.data : [];
      setUsuariosRecords(rows as Record<string, unknown>[]);
      const m = new Map<string, boolean>();
      for (const row of rows) {
        const rec = row as Record<string, unknown>;
        const em = usuarioSheetEmail(rec);
        if (!em) continue;
        m.set(em, isUserActiveInSheet(usuarioSheetUserActiveRaw(rec)));
      }
      setActiveFromSheet(m);
    } catch {
      setBalances([]);
      setUsuariosRecords([]);
      setActiveFromSheet(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleUserActive(email: string, currentActive: boolean) {
    const res = await fetch("/api/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, userActive: !currentActive }),
    });
    if (res.ok) void load();
    else {
      const j = await res.json().catch(() => ({}));
      setBiaMessage({ type: "error", text: String((j as { error?: string }).error || "No se pudo actualizar") });
    }
  }

  function abrirAgregar() {
    setFormData(emptyForm());
    setEmailOriginal("");
    setModalMode("agregar");
  }

  function abrirEditar(rec: Record<string, unknown>) {
    const d = recordToDisplayRow(rec);
    const em = usuarioSheetEmail(rec);
    setEmailOriginal(em);
    setFormData({
      email: em,
      responsable: d.responsable,
      cargo: d.cargo,
      rol: d.rol as UsuarioForm["rol"],
      sector: d.sector === "Costa Caribe" ? "Costa Caribe" : "Bogota",
      area: d.area,
      cedula: d.cedula,
      telefono: d.telefono,
      userActive: activeFromSheet.get(em) ?? true,
      pin: "",
    });
    setModalMode("editar");
  }

  async function guardarUsuario() {
    if (!formData.responsable.trim() || !formData.email.trim()) {
      setBiaMessage({ type: "error", text: "Nombre y correo son obligatorios" });
      return;
    }
    try {
      if (modalMode === "agregar") {
        const res = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email.trim().toLowerCase(),
            responsable: formData.responsable.trim(),
            cargo: formData.cargo.trim(),
            rol: formData.rol,
            sector: formData.sector,
            area: formData.area.trim(),
            cedula: formData.cedula.trim(),
            telefono: formData.telefono.trim(),
            userActive: formData.userActive,
            pin: formData.pin.trim() || "1234",
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBiaMessage({ type: "error", text: String((j as { error?: string }).error || "Error al crear") });
          return;
        }
        setBiaMessage({ type: "success", text: "Usuario creado" });
      } else if (modalMode === "editar") {
        const body: Record<string, unknown> = {
          email: emailOriginal,
          responsable: formData.responsable.trim(),
          correos: formData.email.trim().toLowerCase(),
          cargo: formData.cargo.trim(),
          rol: formData.rol,
          sector: formData.sector,
          area: formData.area.trim(),
          cedula: formData.cedula.trim(),
          telefono: formData.telefono.trim(),
          userActive: formData.userActive,
        };
        if (formData.pin.trim()) body.pin = formData.pin.trim();
        const res = await fetch("/api/usuarios", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBiaMessage({ type: "error", text: String((j as { error?: string }).error || "Error al guardar") });
          return;
        }
        setBiaMessage({ type: "success", text: "Cambios guardados" });
      }
      setModalMode(null);
      await load();
    } catch {
      setBiaMessage({ type: "error", text: "Error de red" });
    }
  }

  async function ejecutarEliminar() {
    if (!confirmEliminar) return;
    const res = await fetch(`/api/usuarios?email=${encodeURIComponent(confirmEliminar)}`, {
      method: "DELETE",
    });
    setConfirmEliminar(null);
    if (res.ok) {
      setBiaMessage({ type: "success", text: "Usuario eliminado de MiCaja" });
      await load();
    } else {
      const j = await res.json().catch(() => ({}));
      setBiaMessage({ type: "error", text: String((j as { error?: string }).error || "No se pudo eliminar") });
    }
  }

  const bMap = useMemo(() => balanceMapFromApi(balances), [balances]);

  const filasDisplay = useMemo(() => {
    return usuariosRecords
      .map((rec) => {
        const d = recordToDisplayRow(rec);
        if (!d.email) return null;
        return { rec, ...d };
      })
      .filter(Boolean) as Array<{
        rec: Record<string, unknown>;
        email: string;
        responsable: string;
        cargo: string;
        rol: string;
        sector: string;
        area: string;
        cedula: string;
        telefono: string;
      }>;
  }, [usuariosRecords]);

  const filtrados = useMemo(() => {
    return filasDisplay.filter((row) => {
      if (filtroZona && row.sector !== filtroZona) return false;
      if (filtroRol && row.rol !== filtroRol) return false;
      return true;
    });
  }, [filasDisplay, filtroZona, filtroRol]);

  const resumen = useMemo(() => {
    let alDia = 0;
    let deuda = 0;
    for (const row of filtrados) {
      const b = balanceForResponsable(bMap, row.responsable);
      if (b.balance === 0) alDia += 1;
      else deuda += 1;
    }
    return { total: filtrados.length, alDia, deuda };
  }, [filtrados, bMap]);

  return (
    <div className="space-y-4">
      {biaMessage ? (
        <BiaAlert type={biaMessage.type} message={biaMessage.text} />
      ) : null}
      {confirmEliminar ? (
        <BiaConfirm
          mensaje="¿Eliminar este usuario de la hoja MiCaja? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirmar={() => void ejecutarEliminar()}
          onCancelar={() => setConfirmEliminar(null)}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-sm text-bia-gray-light">Hoja Usuarios (MiCaja) · balances desde Entregas y Facturas</p>
        </div>
        <Button
          type="button"
          onClick={abrirAgregar}
          className="rounded-xl bg-bia-aqua font-semibold text-bia-blue hover:bg-bia-aqua/90"
        >
          Agregar usuario
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-bia-gray-light">Total (filtrado)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : resumen.total}</p>
            <p className="text-xs text-bia-gray">usuarios</p>
          </CardContent>
        </Card>
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-bia-gray-light">Al día</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">{loading ? "—" : resumen.alDia}</p>
          </CardContent>
        </Card>
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-bia-gray-light">No al día</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{loading ? "—" : resumen.deuda}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="min-w-[180px] space-y-1">
            <label className="text-xs text-bia-gray-light">Zona</label>
            <Select
              value={filtroZona || SIN_FILTRO}
              onValueChange={(v) => {
                const s = v ?? SIN_FILTRO;
                setFiltroZona(s === SIN_FILTRO ? "" : s);
              }}
            >
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Todas las zonas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todas las zonas</SelectItem>
                <SelectItem value="Bogota">Bogotá</SelectItem>
                <SelectItem value="Costa Caribe">Costa Caribe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px] space-y-1">
            <label className="text-xs text-bia-gray-light">Rol</label>
            <Select
              value={filtroRol || SIN_FILTRO}
              onValueChange={(v) => {
                const s = v ?? SIN_FILTRO;
                setFiltroRol(s === SIN_FILTRO ? "" : s);
              }}
            >
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Todos los roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todos los roles</SelectItem>
                <SelectItem value="user">Técnicos</SelectItem>
                <SelectItem value="coordinador">Coordinadores</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Total recibido</TableHead>
                <TableHead>Total gastado</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                  </TableCell>
                </TableRow>
              ) : filtrados.length ? (
                filtrados.map((row) => {
                  const b = balanceForResponsable(bMap, row.responsable);
                  const bal = b.balance;
                  const sheetActive = activeFromSheet.get(row.email);
                  const cuentaActiva = sheetActive !== undefined ? sheetActive : true;
                  const balanceSubCls =
                    bal > 0 ? "text-[#08DDBC]" : bal < 0 ? "text-red-400" : "text-[#525A72]";
                  return (
                    <TableRow key={row.email}>
                      <TableCell className="font-medium">{row.responsable || "—"}</TableCell>
                      <TableCell className="text-xs text-bia-gray-light">{row.email}</TableCell>
                      <TableCell className="text-sm text-bia-gray-light">{row.cargo}</TableCell>
                      <TableCell>{etiquetaZona(row.sector)}</TableCell>
                      <TableCell className="tabular-nums text-sm">{formatCOP(b.totalRecibido)}</TableCell>
                      <TableCell className="tabular-nums text-sm">{formatCOP(b.totalGastado)}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className={`font-medium ${balanceSubCls}`}>{formatCOP(bal)}</span>
                          <span className={`text-xs font-medium ${balanceSubCls}`}>
                            {bal > 0
                              ? `Saldo a favor empresa: ${formatCOP(bal)}`
                              : bal < 0
                                ? `Por reembolsar: ${formatCOP(Math.abs(bal))}`
                                : "Al día"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void toggleUserActive(row.email, cuentaActiva)}
                            className={`rounded-lg border px-2 py-1 text-xs ${
                              cuentaActiva
                                ? "border-bia-aqua/30 text-bia-aqua hover:bg-bia-aqua/10"
                                : "border-red-500/30 text-red-400 hover:bg-red-500/10"
                            }`}
                          >
                            {cuentaActiva ? "Activo" : "Inactivo"}
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEditar(row.rec)}
                            className="rounded-lg border border-bia-gray/30 px-2 py-1 text-xs text-bia-gray-light hover:bg-bia-gray/20 hover:text-white"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmEliminar(row.email)}
                            className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                          >
                            Eliminar
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-bia-gray">
                    Sin usuarios con estos filtros
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {modalMode ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setModalMode(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#525A72]/30 bg-[#0A1B4D] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 font-semibold text-white">
              {modalMode === "agregar" ? "Nuevo usuario" : "Editar usuario"}
            </h3>
            {(
              [
                { label: "Nombre completo", key: "responsable" as const },
                { label: "Correo (@bia.app)", key: "email" as const },
                { label: "Cédula", key: "cedula" as const },
                { label: "Teléfono", key: "telefono" as const },
                { label: "Cargo", key: "cargo" as const },
              ] as const
            ).map((field) => (
              <div key={field.key} className="mb-3">
                <label className="mb-1 block text-xs text-[#8892A4]">{field.label}</label>
                <input
                  value={formData[field.key]}
                  onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full rounded-xl border border-[#525A72]/30 bg-[#001035] px-3 py-2 text-sm text-white"
                />
              </div>
            ))}
            <div className="mb-3">
              <label className="mb-1 block text-xs text-[#8892A4]">Rol</label>
              <select
                value={formData.rol}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, rol: e.target.value as UsuarioForm["rol"] }))
                }
                className="w-full rounded-xl border border-[#525A72]/30 bg-[#001035] px-3 py-2 text-sm text-white"
              >
                <option value="user">Usuario</option>
                <option value="coordinador">Coordinador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-[#8892A4]">Sector</label>
              <select
                value={formData.sector}
                onChange={(e) => setFormData((p) => ({ ...p, sector: e.target.value }))}
                className="w-full rounded-xl border border-[#525A72]/30 bg-[#001035] px-3 py-2 text-sm text-white"
              >
                <option value="Bogota">Bogotá</option>
                <option value="Costa Caribe">Costa Caribe</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-[#8892A4]">Área</label>
              <input
                value={formData.area}
                onChange={(e) => setFormData((p) => ({ ...p, area: e.target.value }))}
                className="w-full rounded-xl border border-[#525A72]/30 bg-[#001035] px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="mb-3 flex items-center gap-2">
              <input
                id="ua"
                type="checkbox"
                checked={formData.userActive}
                onChange={(e) => setFormData((p) => ({ ...p, userActive: e.target.checked }))}
                className="rounded border-bia-gray/40"
              />
              <label htmlFor="ua" className="text-sm text-bia-gray-light">
                Cuenta activa
              </label>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs text-[#8892A4]">
                PIN {modalMode === "editar" ? "(dejar vacío para no cambiar)" : ""}
              </label>
              <input
                value={formData.pin}
                onChange={(e) => setFormData((p) => ({ ...p, pin: e.target.value }))}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-[#525A72]/30 bg-[#001035] px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-xl bg-[#525A72]/20 px-4 py-2 text-sm text-[#8892A4]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void guardarUsuario()}
                className="rounded-xl bg-bia-aqua px-4 py-2 text-sm font-semibold text-bia-blue"
              >
                {modalMode === "agregar" ? "Crear usuario" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
