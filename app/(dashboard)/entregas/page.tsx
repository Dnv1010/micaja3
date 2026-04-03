/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP, formatDateDDMMYYYY, parseMonto } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type EntregaItem = Record<string, unknown>;

function urlComprobanteEntrega(e: EntregaItem): string {
  return String(
    getCellCaseInsensitive(e, "ComprobanteEnvio", "Comprobante") || ""
  ).trim();
}

function comprobantePermiteMiniatura(url: string): boolean {
  const u = url.toLowerCase();
  if (!u.startsWith("https://")) return false;
  if (u.includes("/file/d/")) return false;
  return u.includes("drive.google.com") || u.includes("googleusercontent.com");
}

function drivePreviewEmbedUrl(url: string): string | null {
  const m = url.trim().match(/\/file\/d\/([^/]+)/);
  return m?.[1] ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
}

export default function EntregasPage() {
  const { data } = useSession();
  const responsable = String(data?.user?.responsable || "");
  const [loading, setLoading] = useState(true);
  const [entregas, setEntregas] = useState<EntregaItem[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [imagenModal, setImagenModal] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadEntregas() {
      try {
        const query = new URLSearchParams({ responsable, desde, hasta }).toString();
        const res = await fetch(`/api/entregas?${query}`);
        const json = await res.json().catch(() => ({ data: [] }));
        if (!mounted) return;
        setEntregas(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (!mounted) return;
        setEntregas([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (responsable) {
      setLoading(true);
      void loadEntregas();
    } else setLoading(false);
    return () => {
      mounted = false;
    };
  }, [responsable, desde, hasta]);

  const totalRecibido = useMemo(
    () =>
      entregas.reduce((acc, e) => acc + parseMonto(getCellCaseInsensitive(e, "Monto_Entregado", "Monto")), 0),
    [entregas]
  );

  return (
    <>
      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader className="space-y-3">
          <CardTitle>Entregas recibidas</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto entregado</TableHead>
                  <TableHead className="text-center">Comprobante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={3}>
                        <div className="h-5 w-full animate-pulse rounded bg-bia-blue-mid" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : entregas.length ? (
                  entregas.map((e, i) => {
                    const compUrl = urlComprobanteEntrega(e);
                    const thumb = compUrl.startsWith("https://") && comprobantePermiteMiniatura(compUrl);
                    return (
                      <TableRow key={`e-${i}`}>
                        <TableCell>
                          {formatDateDDMMYYYY(getCellCaseInsensitive(e, "Fecha_Entrega", "Fecha"))}
                        </TableCell>
                        <TableCell>
                          {formatCOP(parseMonto(getCellCaseInsensitive(e, "Monto_Entregado", "Monto")))}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-center">
                          {thumb ? (
                            <button
                              type="button"
                              onClick={() => setImagenModal(compUrl)}
                              className="inline-block"
                            >
                              <img
                                src={`/api/proxy-imagen?url=${encodeURIComponent(compUrl)}`}
                                alt="Comprobante"
                                className="mx-auto h-10 w-10 rounded border border-[#525A72]/20 object-cover hover:border-[#08DDBC]"
                              />
                            </button>
                          ) : compUrl.startsWith("https://") ? (
                            <button
                              type="button"
                              onClick={() => setImagenModal(compUrl)}
                              className="text-xs text-[#08DDBC] hover:underline"
                            >
                              🖼️ Ver
                            </button>
                          ) : (
                            <span className="text-xs text-[#525A72]">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-bia-gray">
                      No hay entregas para el rango seleccionado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-4 text-right text-sm font-semibold">Total recibido: {formatCOP(totalRecibido)}</p>
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
            onClick={(ev) => ev.stopPropagation()}
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
    </>
  );
}
