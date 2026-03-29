import { FacturaForm } from "@/components/facturas/factura-form";

export default function NuevaFacturaPage() {
  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-2xl font-bold">Nueva factura</h1>
      <FacturaForm />
    </div>
  );
}
