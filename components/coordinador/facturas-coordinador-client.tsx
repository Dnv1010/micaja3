"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { sheetANombreBiaTrue } from "@/lib/nueva-factura-validation";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { fallbackActiveZoneUsers } from "@/lib/users-fallback";

type FacturaItem = Record<string, unknown>;

function estadoClass(estado: string): string {
  const e = estado.toLowerCase();
  if (e === "aprobada") return "border-emerald-700 text-emerald-300";
  if (e === "rechazada") return "border-red-700 text-red-300";
  return "border-yellow-700 text-yellow-300";
}

const COLS = 11;

export function FacturasCoordinadorClient({ admin }: { admin?: boolean }) {
  const { data } = useSession();
  const sector = String(data?.user?.sector || "");
  const zoneUsers = useMemo(() => fallbackActiveZoneUsers(sector), [sector]);

  const [usuario, setUsuario] = useState<string>("__todos__");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estado, setEstado] = useState<string>("__todas__");
  const [loading, setLoading] = useState(false);
  const [facturas, setFacturas] = useState<FacturaItem[]>([]);

  async function filtrar() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (!admin) q.set("zonaSector", sector);
      if (usuario && usuario !== "__todos__") q.set("responsable", usuario);
      if (desde) q.set("desde", desde);
      if (hasta) q.set("hasta", hasta);
      if (estado && estado !== "__todas__") q.set("estado", estado);
      const res = await fetch(`/api/facturas?${q}`);
      const json = await res.json().catch(() => ({ data: [] }));
      setFacturas(Array.isArray(json.data) ? json.data : []);
    } catch {
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void filtrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, [admin, sector]);

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
      <CardHeader>
        <CardTitle>Facturas de la zona</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label>Usuario</Label>
            <Select value={usuario} onValueChange={(v) => setUsuario(v || "__todos__")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {zoneUsers.map((u) => (
                  <SelectItem key={u.responsable} value={u.responsable}>
                    {u.responsable}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-zinc-900 border-zinc-700" />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-zinc-900 border-zinc-700" />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v || "__todas__")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="rechazada">Rechazada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full bg-black text-white hover:bg-zinc-800" onClick={filtrar} disabled={loading}>
              Filtrar
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>BIA</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={COLS}>
                    <div className="h-6 animate-pulse rounded bg-zinc-800" />
                  </TableCell>
                </TableRow>
              ) : facturas.length ? (
                facturas.map((f, i) => {
                  const est = getCellCaseInsensitive(f, "Estado") || "Pendiente";
                  const aBia = sheetANombreBiaTrue(
                    getCellCaseInsensitive(f, "ANombreBia", "AnombreBia", "NombreBia")
                  );
                  return (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura"))}
                      </TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Responsable")}</TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getCellCaseInsensitive(f, "NIT", "Nit_Factura") || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatCOP(parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura")))}
                      </TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Ciudad") || "—"}</TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "ServicioDeclarado") || "—"}</TableCell>
                      <TableCell className="max-w-[120px] truncate" title={getCellCaseInsensitive(f, "TipoOperacion")}>
                        {getCellCaseInsensitive(f, "TipoOperacion") || "—"}
                      </TableCell>
                      <TableCell>
                        {aBia ? (
                          <Badge className="border-emerald-700 bg-emerald-950 text-emerald-200">BIA</Badge>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={estadoClass(est)}>
                          {est}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-zinc-500">
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-right text-sm text-zinc-400">Total facturas: {facturas.length}</p>
      </CardContent>
    </Card>
  );
}
