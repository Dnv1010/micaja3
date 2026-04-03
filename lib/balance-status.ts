/** balance = recibido − gastado (solo facturas aprobadas). Positivo: dinero disponible del técnico; negativo: empresa debe reembolso. */
export function balanceStatusTone(balance: number): { label: string; cls: string } {
  if (balance > 0) {
    return { label: "Tiene disponible", cls: "text-[#08DDBC]" };
  }
  if (balance < 0) {
    return { label: "Empresa le debe", cls: "text-red-400" };
  }
  return { label: "Al día", cls: "text-[#525A72]" };
}
