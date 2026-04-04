const fs = require("fs");
const f = "components/pdf/gastos-pdf.tsx";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  'facturaImg: { width: "100%", height: 650, objectFit: "contain", marginTop: 8 },',
  'facturaImg: { width: "100%", height: 720, objectFit: "contain" },'
);
// Reducir el header para dar mas espacio a la imagen
c = c.replace(
  `          <Text style={s.facturaImgTitle}>Factura #{i + 1} - {f.concepto}</Text>
          <Text style={[s.infoRow as any, { fontSize: 8, color: "#555", marginBottom: 8 }]}>Centro: {f.centroCostos} | Fecha: {f.fecha} | Valor: {formatCOP(Number(String(f.valor).replace(/[^0-9]/g, "")))}</Text>
          {f.urlImagen && <Image style={s.facturaImg} src={f.urlImagen} />}`,
  `          <Text style={[s.facturaImgTitle, { marginBottom: 2 }]}>Factura #{i + 1} - {f.concepto}</Text>
          <Text style={{ fontSize: 7, color: "#555", marginBottom: 6 }}>Centro: {f.centroCostos} | Fecha: {f.fecha} | Valor: {formatCOP(Number(String(f.valor).replace(/[^0-9]/g, "")))}</Text>
          {f.urlImagen && <Image style={s.facturaImg} src={f.urlImagen} />}`
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
