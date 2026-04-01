import { Suspense } from "react";
import { LegalizacionesCoordinadorClient } from "@/components/coordinador/legalizaciones-coordinador-client";

export default function LegalizacionesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-bia-gray-light">Cargando...</p>}>
      <LegalizacionesCoordinadorClient />
    </Suspense>
  );
}
