"use client";

type Props = {
  mensaje: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  /** Texto del botón de acción (p. ej. "Eliminar"). */
  confirmLabel?: string;
  variant?: "danger" | "default";
};

export function BiaConfirm({
  mensaje,
  onConfirmar,
  onCancelar,
  confirmLabel = "Confirmar",
  variant = "danger",
}: Props) {
  const confirmCls =
    variant === "danger"
      ? "rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm text-red-400 hover:bg-red-500/30"
      : "rounded-xl border border-[#08DDBC]/30 bg-[#08DDBC]/20 px-4 py-2 text-sm font-semibold text-[#08DDBC] hover:bg-[#08DDBC]/30";

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onCancelar}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-[#525A72]/30 bg-[#0A1B4D] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-6 text-sm text-white">{mensaje}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl bg-[#525A72]/20 px-4 py-2 text-sm text-[#8892A4] hover:bg-[#525A72]/30"
          >
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} className={confirmCls}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
