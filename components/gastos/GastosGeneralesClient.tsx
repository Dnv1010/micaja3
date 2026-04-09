"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GastosIndividualesTab from "@/components/gastos/GastosIndividualesTab";
import GastosAgrupacionesTab from "@/components/gastos/GastosAgrupacionesTab";

export default function GastosGeneralesClient({ rol, sector }: { rol: string; sector: string }) {
  return (
    <Tabs defaultValue="individuales" className="w-full">
      <TabsList className="mb-6 border border-white/10 bg-white/5">
        <TabsTrigger value="individuales" className="data-[state=active]:bg-white/10">
          Gastos Individuales
        </TabsTrigger>
        <TabsTrigger value="agrupaciones" className="data-[state=active]:bg-white/10">
          Agrupaciones / Reportes
        </TabsTrigger>
      </TabsList>
      <TabsContent value="individuales">
        <GastosIndividualesTab rol={rol} sector={sector} />
      </TabsContent>
      <TabsContent value="agrupaciones">
        <GastosAgrupacionesTab rol={rol} sector={sector} />
      </TabsContent>
    </Tabs>
  );
}
