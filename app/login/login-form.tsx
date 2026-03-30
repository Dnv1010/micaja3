"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  Configuration: {
    title: "Error de configuración",
    body:
      "Falta NEXTAUTH_SECRET o NEXTAUTH_URL en Vercel, o las credenciales de Google OAuth son inválidas. Revisa Variables de entorno del proyecto.",
  },
  AccessDenied: {
    title: "Acceso denegado",
    body:
      "El correo con el que entras debe coincidir con la columna de correo en la pestaña Usuarios y UserActive debe ser activo (TRUE/Sí/1). Cuentas @bia.app o @algo.bia.app están permitidas. En Vercel: MICAJA_SPREADSHEET_ID = ID entre /d/ y /edit; GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY correctos; comparte el Sheet con el client_email de la service account. Revisa logs [MiCaja auth] en Vercel → Functions.",
  },
  Callback: {
    title: "Error en el inicio de sesión con Google",
    body:
      "La URL de redirección no coincide. En Google Cloud Console agrega: https://TU-DOMINIO.vercel.app/api/auth/callback/google (y la URL exacta de tu despliegue).",
  },
  OAuthSignin: {
    title: "No se pudo iniciar OAuth",
    body: "Revisa GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel.",
  },
  OAuthCallback: {
    title: "Falló el callback de Google",
    body: "Suele deberse a redirect URI incorrecto o cliente OAuth mal configurado.",
  },
  OAuthCreateAccount: {
    title: "No se pudo crear la cuenta",
    body: "Intenta de nuevo o contacta al administrador.",
  },
  EmailCreateAccount: {
    title: "Error al crear cuenta",
    body: "Usa Google o el acceso con PIN si tu fila en Usuarios tiene columna PIN.",
  },
  SessionRequired: {
    title: "Sesión requerida",
    body: "Debes iniciar sesión para continuar.",
  },
  CredentialsSignin: {
    title: "PIN o correo incorrectos",
    body: "Verifica el correo @bia.app, el PIN de 4 dígitos y que tu usuario tenga PIN en la hoja Usuarios.",
  },
  Default: {
    title: "No se pudo iniciar sesión",
    body: "Vuelve a intentar. Si persiste, revisa los logs en Vercel (Functions) y las variables de entorno.",
  },
};

export function LoginForm({ error }: { error?: string }) {
  const [pinEmail, setPinEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  const info = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default : null;

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    setPinLoading(true);
    try {
      const res = await signIn("credentials", {
        email: pinEmail.trim(),
        pin: pin.trim(),
        redirect: false,
        callbackUrl: "/dashboard",
      });
      if (res?.error) {
        setPinError("Correo o PIN incorrectos, usuario inactivo, o sin PIN en la hoja.");
        return;
      }
      if (res?.ok) {
        window.location.assign(res.url ?? "/dashboard");
      }
    } finally {
      setPinLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            BIA Energy SAS ESP
          </p>
          <CardTitle className="text-2xl">{process.env.NEXT_PUBLIC_APP_NAME || "MiCaja"}</CardTitle>
          <CardDescription>
            Inicia sesión con tu cuenta corporativa <strong>@bia.app</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {info && (
            <Alert variant="destructive">
              <AlertTitle>{info.title}</AlertTitle>
              <AlertDescription className="text-sm mt-1">{info.body}</AlertDescription>
            </Alert>
          )}
          <Button
            type="button"
            size="lg"
            className="w-full min-h-12 text-base"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Continuar con Google
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Si acabas de desplegar: configura <code className="bg-muted px-1 rounded">NEXTAUTH_URL</code>{" "}
            con tu URL pública (https://…vercel.app) y el callback en Google Cloud.
          </p>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground tracking-widest">── o ──</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-50 shadow-inner">
            <p className="text-sm font-medium text-zinc-200 mb-3">Entrar con PIN</p>
            <form onSubmit={handlePinSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pin-email" className="text-zinc-300">
                  Correo
                </Label>
                <Input
                  id="pin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="correo@bia.app"
                  value={pinEmail}
                  onChange={(e) => setPinEmail(e.target.value)}
                  className="h-10 border-zinc-600 bg-zinc-900 text-zinc-50 placeholder:text-zinc-500 focus-visible:border-zinc-400 focus-visible:ring-zinc-400/30"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pin-code" className="text-zinc-300">
                  PIN
                </Label>
                <Input
                  id="pin-code"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="PIN de 4 dígitos"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="h-10 border-zinc-600 bg-zinc-900 text-zinc-50 placeholder:text-zinc-500 focus-visible:border-zinc-400 focus-visible:ring-zinc-400/30 tracking-widest"
                  required
                />
              </div>
              {pinError && (
                <Alert variant="destructive" className="border-red-900 bg-red-950/50 text-red-100">
                  <AlertTitle className="text-red-200">No se pudo entrar</AlertTitle>
                  <AlertDescription className="text-red-100/90">{pinError}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                size="lg"
                disabled={pinLoading}
                className="w-full min-h-11 bg-black text-white hover:bg-zinc-900 border border-zinc-700"
              >
                {pinLoading ? "Comprobando…" : "Entrar con PIN"}
              </Button>
            </form>
            <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
              El PIN lo define un administrador en la columna <span className="font-mono text-zinc-400">PIN</span> de
              la hoja Usuarios. Si está vacío, usa Google.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
