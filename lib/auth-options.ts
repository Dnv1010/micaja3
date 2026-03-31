import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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
        const email = (credentials?.email ?? "").toLowerCase().trim();
        const pin = (credentials?.pin ?? "").trim();
        if (!email || !pin) return null;
        if (!email.endsWith("@bia.app")) return null;

        const user = findFallbackUser(email);
        if (!user || !user.userActive) return null;
        if (user.pin !== pin) return null;

        return {
          id: email,
          email,
          name: user.responsable,
          rol: user.rol,
          sector: user.sector,
          area: user.area,
          cargo: user.cargo,
          responsable: user.responsable,
          cedula: user.cedula ?? "",
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
      }
      return session;
    },
  },
};
