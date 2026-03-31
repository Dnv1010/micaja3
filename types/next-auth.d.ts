import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    rol?: string;
    area?: string;
    sector?: string;
    cargo?: string;
    responsable?: string;
    cedula?: string;
  }

  interface Session {
    user: {
      rol?: string;
      responsable?: string;
      area?: string;
      sector?: string;
      cargo?: string;
      cedula?: string;
      telefono?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol?: string;
    responsable?: string;
    area?: string;
    sector?: string;
    cargo?: string;
    cedula?: string;
    telefono?: string;
    email?: string;
  }
}
