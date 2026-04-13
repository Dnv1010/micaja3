const fs = require("fs");
const f = "lib/telegram-commands.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  `  const tecnicos = usuarios
    .filter(
      (u) =>
        u.userActive &&
        u.rol === "user" &&
        u.sector === zona
    )
    .sort((a, b) => a.responsable.localeCompare(b.responsable, "es"));`,
  `  const tecnicos = usuarios
    .filter(
      (u) =>
        u.userActive &&
        u.sector === zona
    )
    .sort((a, b) => a.responsable.localeCompare(b.responsable, "es"));`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
