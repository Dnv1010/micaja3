const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  "const u0 = usuarios0.find((u) => String(u.telegram_chat_id || \"\").trim() === chatId);",
  "// u0 no usado"
);
fs.writeFileSync(f, c, "utf8");
console.log("✅ Listo");
