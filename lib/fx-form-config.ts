export const FX_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScAkpSf-ui-LusEloIi4_5M9JJnb-Irm3qZyJ4MLwPSkenNfA/viewform";

export const FX_ENTRIES = {
  empresa: "entry.1555314988",
  nombres: "entry.1481318872",
  identificacion: "entry.1904157805",
  cargo: "entry.1654512563",
  correo: "entry.1410371680",
  tipoSolicitud: "entry.706728192",
  descripcion: "entry.845182431",
  departamento: "entry.1421378834",
} as const;

export interface FxFormData {
  empresa: string;
  nombres: string;
  identificacion: string;
  cargo: string;
  correo: string;
  tipoSolicitud: string;
  descripcion: string;
  departamento: string;
}

export function buildFxUrl(data: FxFormData): string {
  const params = new URLSearchParams({
    usp: "pp_url",
    [FX_ENTRIES.empresa]: data.empresa,
    [FX_ENTRIES.nombres]: data.nombres,
    [FX_ENTRIES.identificacion]: data.identificacion,
    [FX_ENTRIES.cargo]: data.cargo,
    [FX_ENTRIES.correo]: data.correo,
    [FX_ENTRIES.tipoSolicitud]: data.tipoSolicitud,
    [FX_ENTRIES.descripcion]: data.descripcion,
    [FX_ENTRIES.departamento]: data.departamento,
  });
  return `${FX_FORM_URL}?${params.toString()}`;
}
