"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
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
        <CardContent>
          <Button
            type="button"
            size="lg"
            className="w-full min-h-12 text-base"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Continuar con Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
