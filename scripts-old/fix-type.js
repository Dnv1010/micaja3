const fs = require("fs");
const f = "app/api/gastos-pdf/route.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  'const session = await getServerSession(authOptions);\n  if (!verifyInternalApiKey(internalKey) && !session?.user?.email) {',
  'const session = await getServerSession(authOptions);\n  if (!verifyInternalApiKey(internalKey as string) && !session?.user?.email) {'
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
