const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  "const sesionGastos2 = getSesionGastos(chatId);",
  "const sesionGastos2 = await getSesionGastos(chatId);"
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
