/** balance = recibido − gastado. Textos alineados con contabilidad de caja menor. */
export function balanceStatusTone(balance: number): { label: string; cls: string } {
  if (balance > 0) {
    return { label: "💰 Debe: le sobra saldo", cls: "text-emerald-400" };
  }
  if (balance < 0) {
    return { label: "✅ A favor: se le debe", cls: "text-blue-400" };
  }
  return { label: "Al día", cls: "text-zinc-400" };
}
