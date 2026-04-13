const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  "await guardarGastosEnSheet_webhook(sesionR, chatId);",
  ""
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
