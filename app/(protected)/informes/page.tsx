"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

type DriveFile = {
  id?: string;
  name?: string;
  createdTime?: string;
  mimeType?: string;
  webViewLink?: string;
};

export default function InformesPage() {
  const [files, setFiles] = useState<DriveFile[]>([]);

  useEffect(() => {
    fetch("/api/informes")
      .then((r) => r.json())
      .then((j) => setFiles(j.data || []));
  }, []);

  const grouped = new Map<string, DriveFile[]>();
  for (const f of files) {
    const day = (f.createdTime || "").slice(0, 10) || "—";
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(f);
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Informes</h1>
        <Link href="/informes/crear" className={cn(buttonVariants({ size: "lg" }), "min-h-11 inline-flex justify-center")}>
          Crear informe
        </Link>
      </div>
      {Array.from(grouped.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([day, list]) => (
          <div key={day} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{day}</h2>
            <ul className="border rounded-lg divide-y">
              {list.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{f.mimeType}</span>
                  {f.webViewLink && (
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                    >
                      Descargar / abrir
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      {files.length === 0 && (
        <p className="text-muted-foreground text-sm">No hay archivos en la carpeta de informes.</p>
      )}
    </div>
  );
}
