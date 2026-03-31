export type FallbackUser = {
  email: string;
  pin: string;
  responsable: string;
  rol: "user" | "coordinador" | "admin";
  sector: "Bogota" | "Costa Caribe";
  area: string;
  cargo: string;
  userActive: boolean;
};

export const FALLBACK_USERS: FallbackUser[] = [
  { email: "dinovi.sanchez@bia.app", pin: "1234", responsable: "Dinovi Sanchez", rol: "coordinador", sector: "Bogota", area: "Bia Bogota", cargo: "Field Operations Planner", userActive: true },
  { email: "edwin.cubides@bia.app", pin: "1234", responsable: "Edwin Cubides", rol: "user", sector: "Costa Caribe", area: "Bia Cartagena", cargo: "Tec. Electricista", userActive: true },
  { email: "javier.alvarez@bia.app", pin: "1234", responsable: "Javier Alvarez", rol: "user", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Tec. Electricista", userActive: true },
  { email: "duvan.cervera@bia.app", pin: "1234", responsable: "Duvan Cervera", rol: "user", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Tec. Electricista", userActive: true },
  { email: "david.goenaga@bia.app", pin: "1234", responsable: "David Goenaga", rol: "user", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Tec. Electricista", userActive: false },
  { email: "jose.arevalo@bia.app", pin: "1234", responsable: "Jose Arevalo", rol: "user", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Tec. Electricista", userActive: true },
  { email: "jonathan.rudas@bia.app", pin: "1234", responsable: "Jonathan Rudas", rol: "user", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Tec. Electricista", userActive: true },
  { email: "hernan.manjarres@bia.app", pin: "1234", responsable: "Hernan Manjarres", rol: "admin", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Manager Field Ops", userActive: true },
  { email: "alejandro.cano@bia.app", pin: "1234", responsable: "Alejandro Cano", rol: "user", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Almacenista", userActive: true },
  { email: "brayan.roncancio@bia.app", pin: "1234", responsable: "Alexander Roncancio", rol: "coordinador", sector: "Bogota", area: "Bia Bogota", cargo: "Operations Coordinator", userActive: false },
  { email: "daniel.florez@bia.app", pin: "1234", responsable: "Daniel Florez", rol: "admin", sector: "Bogota", area: "Bia Bogota", cargo: "Sr. Field Operations Manager", userActive: true },
  { email: "ervison.plata@bia.app", pin: "1234", responsable: "Ervison Plata", rol: "coordinador", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Field Operation Planner", userActive: true },
  { email: "carlos.salas@bia.app", pin: "1234", responsable: "Carlos Salas", rol: "user", sector: "Bogota", area: "Bia Bogota", cargo: "Tec. Electricista", userActive: true },
  { email: "edicson.lopez@bia.app", pin: "1234", responsable: "Edicson Lopez", rol: "user", sector: "Bogota", area: "Bia Bogota", cargo: "Tec. Electricista", userActive: true },
  { email: "harry.baquero@bia.app", pin: "1234", responsable: "Harry Baquero", rol: "user", sector: "Bogota", area: "Bia Bogota", cargo: "Tec. Electricista", userActive: true },
  { email: "juancamilo.jaramillo@bia.app", pin: "1234", responsable: "Juan Jaramillo", rol: "user", sector: "Bogota", area: "Bia Bogota", cargo: "Tec. Electricista", userActive: true },
  { email: "wilson.capador@bia.app", pin: "1234", responsable: "Wilson Capador", rol: "user", sector: "Bogota", area: "Bia Bogota", cargo: "Tec. Electricista", userActive: true },
  { email: "gabriela.villa@bia.app", pin: "1234", responsable: "Gabriela Villa", rol: "admin", sector: "Bogota", area: "Bia Bogota", cargo: "Admin", userActive: true },
  { email: "jhojan.gordillo@bia.app", pin: "1234", responsable: "Jhojan Gordillo", rol: "user", sector: "Bogota", area: "Bia Bogota", cargo: "Tec. Electricista", userActive: true },
  { email: "wilson.fernandez@bia.app", pin: "1234", responsable: "Wilson Fernandez", rol: "user", sector: "Bogota", area: "Bia Bogota", cargo: "Tec. Electricista", userActive: true },
  { email: "jorge.gelvez@bia.app", pin: "1234", responsable: "Jorge Gelvez", rol: "user", sector: "Costa Caribe", area: "Bia Barranquilla", cargo: "Tec. Electricista", userActive: true },
  { email: "gabriel.reyes@bia.app", pin: "1234", responsable: "Gabriel Reyes", rol: "user", sector: "Bogota", area: "Bia Bogota", cargo: "Tec. Electricista", userActive: true },
];

export function findFallbackUser(email: string): FallbackUser | null {
  const normalized = email.toLowerCase().trim();
  return FALLBACK_USERS.find((u) => u.email.toLowerCase() === normalized) ?? null;
}

/** Usuarios operativos de la zona (para coordinador; por ahora solo fallback). */
export function fallbackActiveZoneUsers(sector: string): FallbackUser[] {
  return FALLBACK_USERS.filter(
    (u) => u.sector === sector && u.rol === "user" && u.userActive
  );
}

export function responsablesEnZonaSet(sector: string): Set<string> {
  return new Set(fallbackActiveZoneUsers(sector).map((u) => u.responsable.toLowerCase()));
}
