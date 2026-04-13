const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");
c = "/* eslint-disable @typescript-eslint/no-explicit-any */\n" + c;
fs.writeFileSync(f, c, "utf8");
console.log("ok");
