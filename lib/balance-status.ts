/** balance = recibido − gastado. Positivo: sobra efectivo del técnico a favor de la empresa; negativo: la empresa debe reembolso. */
export function balanceStatusTone(balance: number): { label: string; cls: string } {
  if (balance > 0) {
    return { label: "Saldo a favor empresa", cls: "text-[#08DDBC]" };
  }
  if (balance < 0) {
    return { label: "Empresa le debe", cls: "text-red-400" };
  }
  return { label: "Al día", cls: "text-[#525A72]" };
}
