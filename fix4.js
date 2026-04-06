const fs = require('fs');
let c = fs.readFileSync('components/coordinador/gastos-generales-client.tsx', 'utf8');
c = c.replace('import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";', 'import { formatCOP } from "@/lib/format";');
c = c.replace('export function GastosGeneralesClient({ sector, responsable, rol, chatId }: { sector: string; responsable: string; rol: string; chatId: string })', 'export function GastosGeneralesClient({ responsable, rol, chatId }: { sector: string; responsable: string; rol: string; chatId: string })');
fs.writeFileSync('components/coordinador/gastos-generales-client.tsx', c, 'utf8');
console.log('OK');
