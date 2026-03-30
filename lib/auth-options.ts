import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { findUsuarioByEmailForAuth } from "@/lib/usuarios-data";
import type { UsuarioRow } from "@/types/models";
import { normalizeEmailForAuth, isBiaAppEmail } from "@/lib/email-normalize";

async function loadUsuarioByEmail(email: string): Promise<UsuarioRow | null> {
  return findUsuarioByEmailForAuth(email);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          hd: "bia.app",
          prompt: "select_account",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, profile }) {
      const raw =
        user.email ??
        (profile && typeof profile === "object" && "email" in profile
          ? String((profile as { email?: string }).email ?? "")
          : "");
      const mail = raw ? normalizeEmailForAuth(raw) : "";
      if (!isBiaAppEmail(mail)) {
        console.warn("[MiCaja auth] Dominio no permitido o sin email:", mail || "(vacío)");
        return false;
      }
      const u = await loadUsuarioByEmail(mail);
      if (!u) {
        console.warn("[MiCaja auth] Acceso denegado para:", mail);
      }
      return !!u;
    },
    async jwt({ token, user, trigger, session }) {
      const emailRaw = (user?.email || token.email) as string | undefined;
      const email = emailRaw ? normalizeEmailForAuth(emailRaw) : undefined;
      if (email) {
        const u = await loadUsuarioByEmail(email);
        if (u) {
          token.rol = (u.Rol || "").toLowerCase();
          token.responsable = u.Responsable;
          token.area = u.Area;
          token.sector = u.Sector;
          token.cargo = u.Cargo;
          token.cedula = u.Cedula;
          token.telefono = u.Telefono;
          token.email = email;
        }
      }
      if (trigger === "update" && session?.user) {
        token.name = session.user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.rol = token.rol as string | undefined;
        session.user.responsable = token.responsable as string | undefined;
        session.user.area = token.area as string | undefined;
        session.user.sector = token.sector as string | undefined;
        session.user.cargo = token.cargo as string | undefined;
        session.user.cedula = token.cedula as string | undefined;
        session.user.telefono = token.telefono as string | undefined;
      }
      return session;
    },
  },
};
