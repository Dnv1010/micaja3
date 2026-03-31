"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Data URL completa `data:image/png;base64,...` desde `canvas.toDataURL("image/png")`. */
  onFirma: (base64: string) => void;
  onLimpiar?: () => void;
  width?: number;
  height?: number;
};

export function FirmaCanvas({ onFirma, onLimpiar, width = 400, height = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return { canvas, ctx };
  }, []);

  useEffect(() => {
    const pair = getCtx();
    if (!pair) return;
    const { ctx, canvas } = pair;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [getCtx, width, height]);

  const posFromEvent = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    const me = e as React.MouseEvent;
    return {
      x: (me.clientX - rect.left) * scaleX,
      y: (me.clientY - rect.top) * scaleY,
    };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const pair = getCtx();
    if (!pair) return;
    const { ctx } = pair;
    const { x, y } = posFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pair = getCtx();
    if (!pair) return;
    const { ctx } = pair;
    const { x, y } = posFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawing.current = false;
  };

  const limpiar = () => {
    const pair = getCtx();
    if (!pair) return;
    const { ctx, canvas } = pair;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    onLimpiar?.();
  };

  const confirmar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onFirma(dataUrl);
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full max-w-full touch-none rounded-md border border-zinc-600 bg-white"
        style={{ maxHeight: height, aspectRatio: `${width} / ${height}` }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={limpiar}>
          Limpiar
        </Button>
        <Button type="button" className="bg-black text-white hover:bg-zinc-800" onClick={confirmar}>
          Confirmar firma
        </Button>
      </div>
    </div>
  );
}
