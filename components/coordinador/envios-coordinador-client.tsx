"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { findFallbackUserByResponsable } from "@/lib/users-fallback";
import type { FallbackUser } from "@/lib/users-fallback";

type EnvioRow = Record<string, unknown>;

function isoDateToDDMMYYYY(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function EnviosCoordinadorClient({
  sector,
  zoneUsers,
  uploadResponsableFallback,
}: {
  sector: string;
  zoneUsers: FallbackUser[];
  uploadResponsableFallback: string;
}) {
  const [responsable, setResponsable] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [uploadingComp, setUploadingComp] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const [filtroUser, setFiltroUser] = useState("__todos__");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<EnvioRow[]>([]);

  async function cargarLista() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ sector });
      if (filtroUser && filtroUser !== "__todos__") q.set("responsable", filtroUser);
      if (desde) q.set("desde", desde);
      if (hasta) q.set("hasta", hasta);
      const res = await fetch(`/api/envios?${q}`);
      const json = await res.json().catch(() => ({ data: [] }));
      const rows = Array.isArray(json.data) ? json.data : [];
      setLista(rows);
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector, filtroUser, desde, hasta]);

  const totalPeriodo = useMemo(
    () => lista.reduce((acc, r) => acc + parseCOPString(getCellCaseInsensitive(r, "Monto")), 0),
    [lista]
  );

  function onUsuarioChange(v: string) {
    setResponsable(v);
    const fromList = zoneUsers.find((u) => u.responsable === v);
    const fromFallback = findFallbackUserByResponsable(v);
    const t = fromList?.telefono || fromFallback?.telefono;
    if (t) setTelefono(t);
  }

  async function enviarDinero(e: React.FormEvent) {
    e.preventDefault();
    if (!responsable || !monto) return;
    setSending(true);
    setOkMsg("");
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setOkMsg("Indica un monto válido mayor a 0.");
      setSending(false);
      return;
    }
    try {
      const body = {
        responsable,
        monto: montoNum,
        fecha: isoDateToDDMMYYYY(fecha),
        comprobante: comprobanteUrl.trim(),
        telefono: telefono.trim(),
      };
      const res = await fetch("/api/envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setOkMsg(`✅ Envío registrado para ${responsable}`);
        setMonto("");
        setComprobanteUrl("");
        setTelefono("");
        setResponsable("");
        void cargarLista();
      } else {
        setOkMsg(String(json.error || "No se pudo registrar"));
      }
    } catch {
      setOkMsg("No se pudo registrar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader>
          <CardTitle>Nuevo envío</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviarDinero} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Usuario</Label>
              <Select value={responsable} onValueChange={(v) => onUsuarioChange(v || "")}>
                <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                  <SelectValue placeholder="Seleccione usuario" />
                </SelectTrigger>
                <SelectContent>
                  {zoneUsers.map((u) => (
                    <SelectItem key={u.email} value={u.responsable}>
                      {u.responsable}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
              <p className="text-xs text-bia-gray">Se guarda como {isoDateToDDMMYYYY(fecha)}</p>
            </div>
            <div className="space-y-1">
              <Label>Monto</Label>
              <Input
                type="number"
                min={1}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="bg-bia-blue border-bia-gray/40"
              />
              <p className="text-xs text-bia-gray">{formatCOP(Number(monto || 0))}</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Comprobante (foto o PDF)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                disabled={uploadingComp}
                className="cursor-pointer border-bia-gray/40 bg-bia-blue file:mr-3 file:rounded-md file:border-0 file:bg-bia-aqua/20 file:px-3 file:py-1.5 file:text-sm file:text-bia-aqua"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingComp(true);
                  setOkMsg("");
                  try {
                    const form = new FormData();
                    form.append("file", file);
                    form.append("sector", sector);
                    form.append(
                      "responsable",
                      responsable.trim() || uploadResponsableFallback || "coordinador"
                    );
                    form.append("fecha", fecha);
                    const res = await fetch("/api/facturas/upload", { method: "POST", body: form });
                    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
                    if (res.ok && json.url) {
                      setComprobanteUrl(json.url);
                    } else {
                      setOkMsg(String(json.error || "No se pudo subir el comprobante"));
                    }
                  } catch {
                    setOkMsg("No se pudo subir el comprobante");
                  } finally {
                    setUploadingComp(false);
                    e.target.value = "";
                  }
                }}
              />
              {uploadingComp ? (
                <p className="text-xs text-bia-gray-light">Subiendo comprobante…</p>
              ) : null}
              {comprobanteUrl ? (
                <p className="mt-1 text-xs text-bia-aqua">Comprobante subido (URL lista para el envío)</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Opcional"
                className="bg-bia-blue border-bia-gray/40"
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                className="bg-bia-aqua text-bia-blue font-semibold hover:bg-bia-blue-mid"
                disabled={sending || uploadingComp}
              >
                {sending ? "Enviando..." : "Enviar dinero"}
              </Button>
              {okMsg ? <p className="mt-2 text-sm text-emerald-400">{okMsg}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader>
          <CardTitle>Envíos realizados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Usuario</Label>
              <Select value={filtroUser} onValueChange={(v) => setFiltroUser(v || "__todos__")}>
                <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  {zoneUsers.map((u) => (
                    <SelectItem key={u.email} value={u.responsable}>
                      {u.responsable}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Teléfono</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                    </TableCell>
                  </TableRow>
                ) : lista.length ? (
                  lista.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(r, "Fecha"))}</TableCell>
                      <TableCell>{getCellCaseInsensitive(r, "Responsable")}</TableCell>
                      <TableCell>{formatCOP(parseCOPString(getCellCaseInsensitive(r, "Monto")))}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{getCellCaseInsensitive(r, "Comprobante") || "—"}</TableCell>
                      <TableCell>{getCellCaseInsensitive(r, "Telefono") || "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-bia-gray">
                      Sin envíos en el período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-right text-sm font-medium">Total enviado en el período: {formatCOP(totalPeriodo)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
