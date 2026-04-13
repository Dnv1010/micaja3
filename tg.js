const { getSheetsClient } = require("./lib/google-sheets");
async function test() {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: "1sVDPDsDRL9MiiTrzp6YID7k9h9ZaayE50WAEyodZF1k",
      range: "Gastos_Grupos!A1:N1",
    });
    console.log("OK:", JSON.stringify(res.data.values));
  } catch(e) {
    console.error("ERROR:", e.message);
  }
}
test();