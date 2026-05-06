import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { isBiaAppEmail, normalizeEmailForAuth } from "@/lib/email-normalize";
import { getUsuariosFromSheet } from "@/lib/usuarios-sheet";

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

        const usuarios = await getUsuariosFromSheet();
        const user = usuarios.find((u) => u.email === emailNorm);
        if (!user || !user.userActive || user.pin !== pin) return null;
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
      } else if (!token.area && token.email) {
        // Refresh area (and other fields) for existing sessions that predate this field
        try {
          const usuarios = await getUsuariosFromSheet();
          const found = usuarios.find((u) => u.email === token.email);
          if (found) {
            token.area = found.area;
            if (!token.rol) token.rol = found.rol;
            if (!token.sector) token.sector = found.sector;
            if (!token.cargo) token.cargo = found.cargo;
            if (!token.responsable) token.responsable = found.responsable;
            if (!token.cedula) token.cedula = found.cedula ?? "";
            if (!token.telefono) token.telefono = found.telefono ?? "";
          }
        } catch {
          /* mantener token existente si falla el fetch */
        }
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
