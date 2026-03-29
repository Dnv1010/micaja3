import { formatCOP } from "@/lib/format";

export function PriceDisplay({ value }: { value: number }) {
  return <span className="tabular-nums font-semibold">{formatCOP(value)}</span>;
}
