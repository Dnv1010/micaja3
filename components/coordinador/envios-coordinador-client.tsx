/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SIN_FILTRO } from "@/lib/filter-select";
import { formatCOP, formatDateDDMMYYYY, parseCOPString, parseMonto } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type EnvioRow = Record<string, unknown>;

function isoDateToDDMMYYYY(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Miniatura vía proxy solo si la URL apunta a contenido descargable como imagen. */
function comprobantePermiteMiniatura(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u.startsWith("https://")) return false;
  if (u.includes("/file/d/")) return false;
  return u.includes("drive.google.com") || u.includes("googleusercontent.com");
}

function drivePreviewEmbedUrl(url: string): string | null {
  const m = url.trim().match(/\/file\/d\/([^/]+)/);
  return m?.[1] ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
}

type ZoneUserEnvio = {
  responsable: string;
  telefono: string;
  email: string;
  cargo: string;
  esYo?: boolean;
};

export function EnviosCoordinadorClient({
  sector,
  uploadResponsableFallback,
}: {
  sector: string;
  uploadResponsableFallback: string;
}) {
  const { data: sessionData } = useSession();
  const sessionSector = String(sessionData?.user?.sector || "").trim();
  const sessionResponsable = String(
    sessionData?.user?.responsable || sessionData?.user?.name || ""
  ).trim();

  const [responsable, setResponsable] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState("");
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [comprobantePreview, setComprobantePreview] = useState("");
  const [comprobanteEsPdf, setComprobanteEsPdf] = useState(false);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const previewObjectUrlRef = useRef<string>("");

  const [telefono, setTelefono] = useState("");
  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const [filtroUser, setFiltroUser] = useState(SIN_FILTRO);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<EnvioRow[]>([]);

  const [imagenModal, setImagenModal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [zoneUsers, setZoneUsers] = useState<ZoneUserEnvio[]>([]);

  useEffect(() => {
    let cancelled = false;
    const enc = encodeURIComponent(sector || sessionSector || "Bogota");
    fetch(`/api/usuarios?sector=${enc}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = Array.isArray(d.data) ? d.data : [];
        const list: ZoneUserEnvio[] = [];
        for (const row of rows) {
          const rec = row as Record<string, unknown>;
          const rolU = String(getCellCaseInsensitive(rec, "Rol") || "user").toLowerCase();
          if (rolU !== "user" && rolU !== "coordinador") continue;
          const responsable = String(getCellCaseInsensitive(rec, "Responsable") || "").trim();
          if (!responsable) continue;
          const email = String(getCellCaseInsensitive(rec, "Correos", "Correo", "Email") || "").trim();
          if (!email) continue;
          list.push({
            responsable,
            email,
            telefono: String(getCellCaseInsensitive(rec, "Telefono", "Teléfono") || "").trim(),
            cargo: String(getCellCaseInsensitive(rec, "Cargo") || "").trim(),
          });
        }
        list.sort((a, b) => a.responsable.localeCompare(b.responsable, "es"));
        setZoneUsers(list);
      })
      .catch(() => {
        if (!cancelled) setZoneUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sector, sessionSector]);

  function liberarPreviewObjectUrl() {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = "";
    }
  }

  useEffect(() => {
    return () => {
      liberarPreviewObjectUrl();
    };
  }, []);

  async function cargarLista() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ sector });
      if (filtroUser && filtroUser !== SIN_FILTRO) q.set("responsable", filtroUser);
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

  const usuariosDestino = useMemo((): ZoneUserEnvio[] => {
    const emailSesion = String(sessionData?.user?.email || "").trim();
    const yo = sessionResponsable.trim();
    if (!yo) return zoneUsers.map((u) => ({ ...u, esYo: false }));
    const cargoYo = String(sessionData?.user?.cargo || "Coordinador").trim();
    const telYo = String(sessionData?.user?.telefono || "").trim();
    const self: ZoneUserEnvio = {
      email: emailSesion || `yo-${yo.replace(/\s+/g, "_")}`,
      responsable: yo,
      telefono: telYo,
      cargo: cargoYo || "Coordinador",
      esYo: true,
    };
    const rest = zoneUsers
      .filter((u) => u.responsable.trim().toLowerCase() !== yo.toLowerCase())
      .map((u) => ({ ...u, esYo: false }));
    return [self, ...rest];
  }, [zoneUsers, sessionData?.user?.email, sessionData?.user?.cargo, sessionData?.user?.telefono, sessionResponsable]);

  function onUsuarioChange(v: string) {
    setResponsable(v);
    const fromList = usuariosDestino.find((u) => u.responsable === v);
    const t = fromList?.telefono;
    if (t) setTelefono(t);
  }

  async function onComprobanteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    liberarPreviewObjectUrl();
    const localUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = localUrl;

    setComprobanteFile(file);
    setComprobanteEsPdf(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    setComprobantePreview(localUrl);
    setSubiendoComprobante(true);
    setOkMsg("");

    const sectorUpload = sector || sessionSector || "Bogota";
    const responsableUpload =
      responsable.trim() || uploadResponsableFallback || sessionResponsable || "coordinador";

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sector", sectorUpload);
      form.append("responsable", responsableUpload);
      form.append("fecha", fecha);

      const uploadRes = await fetch("/api/facturas/upload", { method: "POST", body: form });
      if (!uploadRes.ok) {
        const j = (await uploadRes.json().catch(() => ({}))) as { error?: string };
        setOkMsg(String(j.error || "No se pudo subir el comprobante"));
        return;
      }
      const { url } = (await uploadRes.json()) as { url?: string };
      if (!url) {
        setOkMsg("Drive no devolvió URL");
        return;
      }
      setComprobanteUrl(url);

      const esPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") || url.includes("/file/d/");
      if (!esPdf) {
        const ocrRes = await fetch("/api/ocr/factura", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: url }),
        });
        if (ocrRes.ok) {
          const ocrJson = (await ocrRes.json().catch(() => ({}))) as {
            data?: { monto_factura?: number | string | null };
            monto_factura?: number | string | null;
          };
          const raw = ocrJson?.data?.monto_factura ?? ocrJson?.monto_factura;
          const num =
            typeof raw === "number" && Number.isFinite(raw) ? raw : parseMonto(raw);
          if (num > 0) {
            setMonto(String(Math.round(num)));
          }
        }
      }
    } catch (err) {
      console.error("Error subiendo comprobante:", err);
      setOkMsg("Error al procesar el comprobante");
    } finally {
      setSubiendoComprobante(false);
    }
  }

  function limpiarComprobanteSeleccion() {
    liberarPreviewObjectUrl();
    setComprobantePreview("");
    setComprobanteUrl("");
    setComprobanteFile(null);
    setComprobanteEsPdf(false);
  }

  async function enviarDinero(ev: React.FormEvent) {
    ev.preventDefault();
    if (!responsable) {
      setOkMsg("Selecciona un usuario destinatario.");
      return;
    }
    if (!monto) {
      setOkMsg("Ingresa el monto a enviar.");
      return;
    }
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
      const json = await res.json().catch(() => ({})) as { error?: string; notificado?: boolean };
      if (res.ok) {
        const sinTelegram = json.notificado === false
          ? " ⚠️ El usuario no tiene Telegram vinculado y no fue notificado."
          : "";
        setOkMsg(`✅ Envío registrado para ${responsable}.${sinTelegram}`);
        setMonto("");
        limpiarComprobanteSeleccion();
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
                  {usuariosDestino.map((u) => (
                    <SelectItem key={u.email || u.responsable} value={u.responsable}>
                      {u.responsable}
                      {u.esYo ? " (yo)" : ""} — {u.cargo || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-bia-blue border-bia-gray/40"
              />
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

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-[#8892A4]">
                Comprobante (foto o PDF)
                {subiendoComprobante ? (
                  <span className="ml-2 text-xs text-[#08DDBC]">Subiendo y leyendo valor…</span>
                ) : null}
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#525A72]/30 bg-[#001035] px-4 py-3 transition-colors hover:border-[#08DDBC]/50">
                <span className="text-sm text-[#08DDBC]">Seleccionar archivo</span>
                <span className="text-xs text-[#525A72]">
                  {comprobanteFile?.name || "JPG, PNG o PDF"}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  disabled={subiendoComprobante}
                  onChange={(e) => void onComprobanteChange(e)}
                />
              </label>

              {comprobantePreview ? (
                <div className="relative mt-3 inline-block">
                  {comprobanteEsPdf ? (
                    <div className="rounded-lg border border-[#525A72]/20 bg-bia-blue px-4 py-6 text-center text-sm text-bia-gray-light">
                      Vista previa PDF: {comprobanteFile?.name || "archivo"}
                    </div>
                  ) : (
                    <img
                      src={comprobantePreview}
                      alt="Comprobante"
                      className="h-32 w-auto rounded-lg border border-[#525A72]/20 bg-white object-contain"
                    />
                  )}
                  <button
                    type="button"
                    onClick={limpiarComprobanteSeleccion}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                    aria-label="Quitar comprobante"
                  >
                    ✕
                  </button>
                </div>
              ) : null}

              {comprobanteUrl && !subiendoComprobante ? (
                <p className="mt-1 text-xs text-[#08DDBC]">Comprobante guardado en Drive</p>
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
                disabled={sending || subiendoComprobante}
              >
                {sending ? "Enviando..." : "Enviar dinero"}
              </Button>
              {okMsg ? (
                <p className={`mt-2 text-sm ${okMsg.startsWith("✅") ? "text-emerald-400" : "text-amber-400"}`}>
                  {okMsg}
                </p>
              ) : null}
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
              <Select value={filtroUser} onValueChange={(v) => setFiltroUser(v || SIN_FILTRO)}>
                <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_FILTRO}>Todos</SelectItem>
                  {usuariosDestino.map((u) => (
                    <SelectItem key={`f-${u.email || u.responsable}`} value={u.responsable}>
                      {u.responsable}
                      {u.esYo ? " (yo)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="bg-bia-blue border-bia-gray/40"
              />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="bg-bia-blue border-bia-gray/40"
              />
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
                    <TableCell colSpan={6}>
                      <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                    </TableCell>
                  </TableRow>
                ) : lista.length ? (
                  lista.map((r, i) => {
                    const comp = String(getCellCaseInsensitive(r, "Comprobante") || "").trim();
                    const thumb = comp.startsWith("https://") && comprobantePermiteMiniatura(comp);

  async function eliminarEnvio(id: string) {
    if (!confirm("Eliminar este envio?")) return;
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
        const j = (await res.json().catch(() => ({}))) as Record<string, string>;
        alert(String(j.error || "No se pudo eliminar"));
      }
    } catch {
      alert("Error al eliminar");
    } finally {
      setDeleting(null);
    }
  }

                    return (
                      <TableRow key={i}>
                        <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(r, "Fecha"))}</TableCell>
                        <TableCell>{getCellCaseInsensitive(r, "Responsable")}</TableCell>
                        <TableCell>{formatCOP(parseCOPString(getCellCaseInsensitive(r, "Monto")))}</TableCell>
                        <TableCell className="px-2 py-2">
                          {thumb ? (
                            <button
                              type="button"
                              onClick={() => setImagenModal(comp)}
                              className="group relative"
                            >
                              <img
                                src={`/api/proxy-imagen?url=${encodeURIComponent(comp)}`}
                                alt="Comprobante"
                                className="h-10 w-10 rounded border border-[#525A72]/20 object-cover transition-colors hover:border-[#08DDBC]"
                              />
                              <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                                Ver comprobante
                              </span>
                            </button>
                          ) : comp.startsWith("https://") ? (
                            <button
                              type="button"
                              onClick={() => setImagenModal(comp)}
                              className="text-xs text-[#08DDBC] hover:underline"
                            >
                              🖼️ Ver
                            </button>
                          ) : (
                            <span className="text-xs text-[#525A72]">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getCellCaseInsensitive(r, "Telefono") || "—"}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => eliminarEnvio(String(Object.values(r)[0] || ""))}
                            disabled={deleting === String(Object.values(r)[0] || "")}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {deleting === String(Object.values(r)[0] || "") ? "..." : "Eliminar"}
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-bia-gray">
                      Sin envíos en el período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-right text-sm font-medium">
            Total enviado en el período: {formatCOP(totalPeriodo)}
          </p>
        </CardContent>
      </Card>

      {imagenModal ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImagenModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-[#0A1B4D] px-4 py-2">
              <span className="text-sm text-white">Comprobante de envío</span>
              <button
                type="button"
                onClick={() => setImagenModal(null)}
                className="text-[#525A72] hover:text-white"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            {drivePreviewEmbedUrl(imagenModal) ? (
              <iframe
                title="Comprobante"
                src={drivePreviewEmbedUrl(imagenModal)!}
                className="h-[70vh] w-full border-0"
              />
            ) : (
              <img
                src={`/api/proxy-imagen?url=${encodeURIComponent(imagenModal)}`}
                alt="Comprobante"
                className="max-h-[70vh] w-full object-contain"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
