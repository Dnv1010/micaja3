"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
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
    <div className="min-h-screen bg-[#0a0a0a] p-4 flex items-center justify-center">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">BIA Energy SAS ESP</p>
          <CardTitle className="text-3xl font-bold text-white">MiCaja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loginError && (
            <Alert className="border-red-900 bg-red-950/30 text-red-100">
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handlePinSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-zinc-300">
                Correo electronico
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="usuario@bia.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin" className="text-zinc-300">
                PIN
              </Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="4 digitos"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-11 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 tracking-[0.25em]"
                required
              />
            </div>
            <Button type="submit" className="w-full h-11 bg-black text-white hover:bg-zinc-800" disabled={loading}>
              {loading ? "Validando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
