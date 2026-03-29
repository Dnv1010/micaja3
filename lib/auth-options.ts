import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { SHEET_NAMES } from "@/lib/google-sheets";
import type { UsuarioRow } from "@/types/models";

function isUserActive(value: string | undefined): boolean {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  return v === "TRUE" || v === "SI" || v === "SÍ" || v === "YES" || v === "1";
}

async function loadUsuarioByEmail(email: string): Promise<UsuarioRow | null> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const rows = await getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS);
    const usuarios = rowsToObjects<UsuarioRow>(rows);
    const found = usuarios.find(
      (u) => u.Correos?.trim().toLowerCase() === normalizedEmail && isUserActive(u.UserActive)
    );
    return found ?? null;
  } catch (e) {
    console.error(
      "[MiCaja auth] Error leyendo hoja Usuarios (Sheets API). ¿Variables GOOGLE_* en Vercel y hoja compartida con el service account?",
      e instanceof Error ? e.message : e
    );
    return null;
  }
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
    async signIn({ user }) {
      if (!user.email?.endsWith("@bia.app")) return false;
      const u = await loadUsuarioByEmail(user.email);
      return !!u;
    },
    async jwt({ token, user, trigger, session }) {
      const email = (user?.email || token.email) as string | undefined;
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
