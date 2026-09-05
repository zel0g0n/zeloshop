// ATMOS proksi-VM uchun VAQTINCHALIK tekshiruv serveri.
// Vazifasi: /whoami so'ralganda, o'zining HAQIQIY tashqi (chiquvchi)
// IP manzilini (ipify.org orqali) aniqlab qaytaradi — shu orqali VM
// haqiqatan ham statik IP orqali internetga chiqayotganini isbotlaydi.
const http = require("http");
const https = require("https");

const PORT = 8080;

function getExternalIp() {
  return new Promise((resolve, reject) => {
    https
      .get("https://api.ipify.org?format=json", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data).ip);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/whoami") {
    try {
      const ip = await getExternalIp();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, vmOutboundIp: ip }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Topilmadi. /whoami dan foydalaning." }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Test-server ${PORT}-portda ishga tushdi.`);
});
