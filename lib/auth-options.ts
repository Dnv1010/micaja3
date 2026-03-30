import type { NextAuthOptions } from "next-auth";
import type { User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { findUsuarioByEmailForAuth, usuarioPinFromRow } from "@/lib/usuarios-data";
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
    CredentialsProvider({
      id: "credentials",
      name: "PIN",
      credentials: {
        email: { label: "Correo", type: "email", placeholder: "correo@bia.app" },
        pin: { label: "PIN", type: "password", placeholder: "PIN de 4 dígitos" },
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email;
        const rawPin = credentials?.pin;
        if (rawEmail == null || rawPin == null) return null;
        const email = normalizeEmailForAuth(String(rawEmail));
        if (!isBiaAppEmail(email)) return null;

        let storedPin = "";
        let userName = email;
        let userRol = "user";
        let userSector = "";
        let userArea = "";
        let userCargo = "";

        try {
          const u = await findUsuarioByEmailForAuth(email);
          if (u) {
            storedPin = usuarioPinFromRow(u).trim();
            userName = (u.Responsable || "").trim() || email;
            userRol = (u.Rol || "user").toLowerCase();
            userSector = u.Sector || "";
            userArea = u.Area || "";
            userCargo = u.Cargo || "";
          }
        } catch {
          /* Sheets no disponible — usar fallback */
        }

        if (!storedPin) {
          const { findFallbackUser } = await import("@/lib/users-fallback");
          const fb = findFallbackUser(email);
          if (!fb || !fb.userActive) return null;
          storedPin = fb.pin;
          userName = fb.responsable;
          userRol = fb.rol.toLowerCase();
          userSector = fb.sector;
          userArea = fb.area;
          userCargo = fb.cargo;
        }

        if (!storedPin) return null;
        if (storedPin !== String(rawPin).trim()) return null;

        return {
          id: email,
          email,
          name: userName,
          rol: userRol,
          sector: userSector,
          area: userArea,
          cargo: userCargo,
        };
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
    async signIn({ user, profile, account }) {
      if (account?.provider === "credentials") {
        return true;
      }
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
    async jwt({ token, user, account, trigger, session }) {
      const emailRaw = (user?.email || token.email) as string | undefined;
      const email = emailRaw ? normalizeEmailForAuth(emailRaw) : undefined;
      if (email) {
        let filledFromSheet = false;
        try {
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
            filledFromSheet = true;
          }
        } catch {
          /* Sheets no disponible — usar datos del user (credentials) si aplica */
        }

        if (!filledFromSheet && account?.provider === "credentials" && user) {
          const u = user as User;
          token.rol = u.rol ?? token.rol ?? "user";
          token.responsable = u.name ?? token.responsable;
          token.sector = u.sector ?? token.sector;
          token.area = u.area ?? token.area;
          token.cargo = u.cargo ?? token.cargo;
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
