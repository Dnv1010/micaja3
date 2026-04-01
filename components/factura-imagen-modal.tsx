"use client";

import { useEffect, useState } from "react";

type Props = {
  src: string | null;
  onClose: () => void;
};

function iframeSrcForFactura(src: string): string {
  const fileMatch = src.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  return src;
}

function isIframeForSrc(src: string): boolean {
  return (
    /\.pdf(\?|#|$)/i.test(src) ||
    src.includes("/view") ||
    /drive\.google\.com\/file\/d\//.test(src)
  );
}

export function FacturaImagenModal({ src, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const iframe = src ? isIframeForSrc(src) : false;
  if (!mounted || !src) return null;
  const iframeSrc = iframe ? iframeSrcForFactura(src) : src;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#0A1B4D] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Imagen de factura"
      >
        <div className="flex items-center justify-between border-b border-[#525A72]/20 px-4 py-3">
          <span className="text-sm font-medium text-white">ðŸ“Ž Imagen de factura</span>
          <div className="flex gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#08DDBC] hover:underline"
            >
              Abrir en Drive â†—
            </a>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 text-xl leading-none text-[#525A72] hover:text-white"
              aria-label="Cerrar"
            >
              âœ•
            </button>
          </div>
        </div>

        <div className="flex min-h-[300px] items-center justify-center bg-white p-4">
          {iframe ? (
            <iframe src={iframeSrc} className="h-[500px] w-full" title="Factura PDF" />
          ) : (
            <img
              src={src}
              alt="Factura"
              className="max-h-[500px] max-w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "";
                (e.target as HTMLImageElement).alt = "No se pudo cargar la imagen";
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
