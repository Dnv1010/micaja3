import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MiCaja — BIA Energy",
  description: "Gestión de caja menor — BIA Energy SAS ESP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <head>
        {/* Aplica el tema antes del primer paint para evitar flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
