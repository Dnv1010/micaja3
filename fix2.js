const fs = require("fs");
const f = "app/api/gastos-pdf/route.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  "return new NextResponse(pdfBuffer, {",
  "return new NextResponse(new Uint8Array(pdfBuffer), {"
);
console.log("Tiene Uint8Array:", c.includes("Uint8Array"));
fs.writeFileSync(f, c, "utf8");
