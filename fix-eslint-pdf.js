const fs = require("fs");
const f = "components/pdf/gastos-pdf.tsx";
let c = fs.readFileSync(f, "utf8");
c = "/* eslint-disable @typescript-eslint/no-explicit-any */\n/* eslint-disable jsx-a11y/alt-text */\n" + c;
fs.writeFileSync(f, c, "utf8");
console.log("ok");
