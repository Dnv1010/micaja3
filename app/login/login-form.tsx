"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  Configuration: {
    title: "Error de configuración",
    body:
      "Falta NEXTAUTH_SECRET o NEXTAUTH_URL en Vercel, o las credenciales de Google OAuth son inválidas. Revisa Variables de entorno del proyecto.",
  },
  AccessDenied: {
    title: "Acceso denegado",
    body:
      "Cuenta @bia.app, UserActive activo y correo en la hoja Usuarios. La app lee Usuarios en Petty Cash y en el libro MiCaja (MICAJA_SPREADSHEET_ID). Si solo está en MiCaja2, confirma ese ID en Vercel y que el service account tenga acceso al archivo.",
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
    body: "Este proyecto solo usa inicio de sesión con Google.",
  },
  SessionRequired: {
    title: "Sesión requerida",
    body: "Debes iniciar sesión para continuar.",
  },
  Default: {
    title: "No se pudo iniciar sesión",
    body: "Vuelve a intentar. Si persiste, revisa los logs en Vercel (Functions) y las variables de entorno.",
  },
};

export function LoginForm({ error }: { error?: string }) {
  const info = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default : null;

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
        </CardContent>
      </Card>
    </div>
  );
}
