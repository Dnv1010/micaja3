"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Label } from "@/components/ui/label";

export function LoginForm({ error }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState<string | null>(error ? "Correo o PIN incorrecto" : null);
  const [loading, setLoading] = useState(false);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        pin: pin.trim(),
        redirect: false,
        callbackUrl: "/",
      });
      if (!res || res.error) {
        setLoginError("Correo o PIN incorrecto");
        return;
      }
      window.location.assign(res.url ?? "/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bia-blue p-4">
      <div className="w-full max-w-sm rounded-2xl border border-bia-gray/30 bg-bia-blue-mid p-8 shadow-2xl">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="text-3xl text-bia-aqua" aria-hidden>
            ⚡
          </span>
          <span className="text-2xl font-bold tracking-wide text-white">Bia</span>
        </div>

        <h1 className="mb-1 text-center text-xl font-semibold text-white">MiCaja</h1>
        <p className="mb-6 text-center text-sm text-bia-gray-light">BIA Energy SAS ESP</p>

        {loginError ? (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-400">⚠️ {loginError}</p>
          </div>
        ) : null}

        <form onSubmit={handlePinSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-bia-gray-light">
              Correo electrónico
            </Label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="usuario@bia.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-1 w-full rounded-xl border border-bia-gray/50 bg-bia-blue px-4 py-3 text-white placeholder:text-bia-gray focus:border-bia-aqua focus:outline-none"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin" className="text-bia-gray-light">
              PIN
            </Label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="4 dígitos"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-xl border border-bia-gray/50 bg-bia-blue px-4 py-3 tracking-[0.25em] text-white placeholder:text-bia-gray focus:border-bia-aqua focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-bia-aqua py-3 font-bold text-bia-blue transition-colors hover:bg-[#06C4A8] disabled:opacity-50"
          >
            {loading ? "Validando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
