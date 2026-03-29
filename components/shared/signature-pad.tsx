"use client";

import { useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";

export function SignaturePad({
  onEnd,
  className,
}: {
  onEnd: (dataUrl: string) => void;
  className?: string;
}) {
  const ref = useRef<SignatureCanvas>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.getCanvas().parentElement;
      if (!parent) return;
      canvas.getCanvas().width = parent.clientWidth;
      canvas.getCanvas().height = 160;
      canvas.clear();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className={className}>
      <div className="border rounded-lg bg-white w-full overflow-hidden">
        <SignatureCanvas
          ref={ref}
          penColor="#111"
          canvasProps={{
            className: "w-full touch-none",
            style: { height: 160, width: "100%" },
          }}
          onEnd={() => {
            const data = ref.current?.toDataURL("image/png");
            if (data) onEnd(data);
          }}
        />
      </div>
      <div className="flex gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            ref.current?.clear();
            onEnd("");
          }}
        >
          Limpiar
        </Button>
      </div>
    </div>
  );
}
