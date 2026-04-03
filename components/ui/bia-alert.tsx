"use client";

type AlertType = "success" | "error" | "warning" | "info";

const styles: Record<AlertType, string> = {
  success: "bg-[#08DDBC]/10 border-[#08DDBC]/30 text-[#08DDBC]",
  error: "bg-red-500/10 border-red-500/30 text-red-400",
  warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  info: "bg-[#4728EF]/10 border-[#4728EF]/30 text-[#DEDEF9]",
};

const icons: Record<AlertType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function BiaAlert({ type, message }: { type: AlertType; message: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${styles[type]}`}
    >
      <span className="font-bold" aria-hidden>
        {icons[type]}
      </span>
      <span>{message}</span>
    </div>
  );
}
