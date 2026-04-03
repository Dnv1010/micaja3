import { normalizeEmailForAuth } from "@/lib/email-normalize";
import { normalizeSector } from "@/lib/sector-normalize";

export type FallbackUser = {
  email: string;
  pin: string;
  responsable: string;
  rol: "user" | "coordinador" | "admin";
  sector: "Bogota" | "Costa Caribe";
  area: string;
  cargo: string;
  userActive: boolean;
  cedula?: string;
  telefono?: string;
};

export const FALLBACK_USERS: FallbackUser[] = [
  {
    email: "dinovi.sanchez@bia.app",
    pin: "1234",
    responsable: "Dinovi Sanchez",
    rol: "coordinador",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Field Ops Planner",
    cedula: "1096215786",
    userActive: true,
    telefono: "573006400913",
  },
  {
    email: "edwin.cubides@bia.app",
    pin: "1234",
    responsable: "Edwin Cubides",
    rol: "user",
    sector: "Costa Caribe",
    area: "Bia Cartagena",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573006400757",
  },
  {
    email: "javier.alvarez@bia.app",
    pin: "1234",
    responsable: "Javier Alvarez",
    rol: "user",
    sector: "Costa Caribe",
    area: "Bia Barranquilla",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573006400889",
  },
  {
    email: "duvan.cervera@bia.app",
    pin: "1234",
    responsable: "Duvan Cervera",
    rol: "user",
    sector: "Costa Caribe",
    area: "Bia Barranquilla",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573006401149",
  },
  { email: "david.goenaga@bia.app", pin: "1234", responsable: "David Goenaga", rol: "user", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Tec. Electricista", userActive: false },
  {
    email: "jose.arevalo@bia.app",
    pin: "1234",
    responsable: "Jose Arevalo",
    rol: "user",
    sector: "Costa Caribe",
    area: "Bia Barranquilla",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573006400854",
  },
  {
    email: "jonathan.rudas@bia.app",
    pin: "1234",
    responsable: "Jonathan Rudas",
    rol: "user",
    sector: "Costa Caribe",
    area: "Bia Barranquilla",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573006401034",
  },
  {
    email: "hernan.manjarres@bia.app",
    pin: "1234",
    responsable: "Hernan Manjarres",
    rol: "admin",
    sector: "Costa Caribe",
    area: "Bia Barranquilla",
    cargo: "Manager Field Ops",
    cedula: "1082950437",
    userActive: true,
    telefono: "573006400828",
  },
  {
    email: "alejandro.cano@bia.app",
    pin: "1234",
    responsable: "Alejandro Cano",
    rol: "user",
    sector: "Costa Caribe",
    area: "Bia Barranquilla",
    cargo: "Almacenista",
    userActive: true,
    telefono: "573005496674",
  },
  {
    email: "brayan.roncancio@bia.app",
    pin: "1234",
    responsable: "Alexander Roncancio",
    rol: "coordinador",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Field Ops Planner",
    userActive: false,
  },
  { email: "daniel.florez@bia.app", pin: "1234", responsable: "Daniel Florez", rol: "admin", sector: "Bogota", area: "Bia Bogota", cargo: "Sr. Field Operations Manager", userActive: true },
  {
    email: "ervison.plata@bia.app",
    pin: "1234",
    responsable: "Ervison Plata",
    rol: "coordinador",
    sector: "Costa Caribe",
    area: "Bia Barranquilla",
    cargo: "Field Ops Planner",
    cedula: "1004371043",
    userActive: true,
    telefono: "573044025703",
  },
  {
    email: "carlos.salas@bia.app",
    pin: "1234",
    responsable: "Carlos Salas",
    rol: "user",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573044025797",
  },
  {
    email: "edicson.lopez@bia.app",
    pin: "1234",
    responsable: "Edicson Lopez",
    rol: "user",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573005496668",
  },
  {
    email: "harry.baquero@bia.app",
    pin: "1234",
    responsable: "Harry Baquero",
    rol: "user",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573006401065",
  },
  {
    email: "juancamilo.jaramillo@bia.app",
    pin: "1234",
    responsable: "Juan Jaramillo",
    rol: "user",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573044025949",
  },
  {
    email: "wilson.capador@bia.app",
    pin: "1234",
    responsable: "Wilson Capador",
    rol: "user",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573044025738",
  },
  { email: "gabriela.villa@bia.app", pin: "1234", responsable: "Gabriela Villa", rol: "admin", sector: "Bogota", area: "Bia Bogota", cargo: "Admin", userActive: true },
  {
    email: "jhojan.gordillo@bia.app",
    pin: "1234",
    responsable: "Jhojan Gordillo",
    rol: "user",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573044025703",
  },
  {
    email: "wilson.fernandez@bia.app",
    pin: "1234",
    responsable: "Wilson Fernandez",
    rol: "user",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573014039314",
  },
  {
    email: "jorge.gelvez@bia.app",
    pin: "1234",
    responsable: "Jorge Gelvez",
    rol: "user",
    sector: "Costa Caribe",
    area: "Bia Barranquilla",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573246160713",
  },
  {
    email: "gabriel.reyes@bia.app",
    pin: "1234",
    responsable: "Gabriel Reyes",
    rol: "user",
    sector: "Bogota",
    area: "Bia Bogota",
    cargo: "Tec. Electricista",
    userActive: true,
    telefono: "573021164435",
  },
];

export function findFallbackUser(email: string): FallbackUser | null {
  const normalized = normalizeEmailForAuth(email);
  return FALLBACK_USERS.find((u) => normalizeEmailForAuth(u.email) === normalized) ?? null;
}

/** Coincide por nombre de responsable (p. ej. columna Coordinador del reporte). */
export function findFallbackUserByResponsable(responsable: string): FallbackUser | null {
  const t = responsable.trim().toLowerCase();
  if (!t) return null;
  return FALLBACK_USERS.find((u) => u.responsable.trim().toLowerCase() === t) ?? null;
}

/** Usuarios operativos de la zona (para coordinador; por ahora solo fallback). */
export function fallbackActiveZoneUsers(sector: string): FallbackUser[] {
  const target = normalizeSector(sector);
  return FALLBACK_USERS.filter((u) => {
    const uCanon = normalizeSector(u.sector);
    const zoneOk =
      (target !== null && uCanon === target) || (target === null && u.sector === sector.trim());
    return zoneOk && u.rol === "user" && u.userActive;
  });
}

export function responsablesEnZonaSet(sector: string): Set<string> {
  return new Set(fallbackActiveZoneUsers(sector).map((u) => u.responsable.toLowerCase()));
}
