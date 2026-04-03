import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { isBiaAppEmail, normalizeEmailForAuth } from "@/lib/email-normalize";
import { getUsuariosFromSheet } from "@/lib/usuarios-sheet";
import { findFallbackUser } from "@/lib/users-fallback";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "PIN",
      credentials: {
        email: { label: "Correo", type: "email" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        const emailNorm = normalizeEmailForAuth(credentials?.email ?? "");
        const pin = (credentials?.pin ?? "").trim();
        if (!emailNorm || !pin) return null;
        if (!isBiaAppEmail(emailNorm)) return null;

        try {
          const usuarios = await getUsuariosFromSheet();
          const user = usuarios.find((u) => u.email === emailNorm);
          if (user) {
            if (!user.userActive) return null;
            if (user.pin !== pin) return null;
            return {
              id: emailNorm,
              email: emailNorm,
              name: user.responsable,
              rol: user.rol,
              sector: user.sector,
              area: user.area,
              cargo: user.cargo,
              responsable: user.responsable,
              cedula: user.cedula ?? "",
              telefono: user.telefono ?? "",
            };
          }
        } catch {
          /* fallback */
        }

        const fb = findFallbackUser(emailNorm);
        if (!fb || !fb.userActive || fb.pin !== pin) return null;
        return {
          id: emailNorm,
          email: emailNorm,
          name: fb.responsable,
          rol: fb.rol,
          sector: fb.sector,
          area: fb.area,
          cargo: fb.cargo,
          responsable: fb.responsable,
          cedula: fb.cedula ?? "",
          telefono: fb.telefono ?? "",
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.rol = (user as { rol?: string }).rol;
        token.sector = (user as { sector?: string }).sector;
        token.area = (user as { area?: string }).area;
        token.cargo = (user as { cargo?: string }).cargo;
        token.responsable = (user as { responsable?: string }).responsable;
        token.cedula = (user as { cedula?: string }).cedula;
        token.telefono = (user as { telefono?: string }).telefono;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.rol = token.rol as string;
        session.user.sector = token.sector as string;
        session.user.area = token.area as string;
        session.user.cargo = token.cargo as string;
        session.user.responsable = token.responsable as string;
        session.user.cedula = token.cedula as string;
        session.user.telefono = token.telefono as string;
      }
      return session;
    },
  },
};
