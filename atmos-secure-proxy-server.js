/**
 * ATMOS uchun STATIK-IP FORWARD-PROKSI SERVERI — GCP VM'da ishlaydi
 * (statik IP: 35.211.129.224). Eski `atmos-proxy-vm-test-server.js`
 * (faqat `/whoami` bilan javob beradigan, HAQIQIY proksi vazifasini
 * bajarmaydigan diagnostika serveri) shu fayl bilan ALMASHTIRILADI.
 *
 * IKKITA VAZIFA:
 *   1) GET /whoami — diagnostika (VM haqiqatan shu statik IP orqali
 *      chiqayotganini tekshirish uchun, ilgarigidek).
 *   2) HTTP CONNECT usuli — HAQIQIY forward-proksi: `functions/lib/
 *      atmosClient.js`dagi Cloud Function'dan kelgan HTTPS so'rovlarni
 *      Atmos API'siga (apigw.atmos.uz) shu VM orqali TUNNEL qiladi —
 *      shunda Atmos tarafida so'rov aynan shu statik IP'dan kelgan
 *      bo'lib ko'rinadi. (`undici`ning `ProxyAgent`si aynan shu CONNECT
 *      protokolini ishlatadi — mos.)
 *
 * XAVFSIZLIK (MUHIM): Cloud Functions'ning o'zi statik/oldindan
 * ma'lum IP'ga ega EMAS (Google'ning umumiy, o'zgaruvchan IP hovuzi) —
 * shuning uchun VM'ning firewall darajasida "faqat ma'lum IP'dan"
 * deb cheklab BO'LMAYDI, portni butun internetga ochish shart bo'ladi.
 * Buning o'rniga himoya ILOVA darajasida ta'minlanadi:
 *   - HAR BIR CONNECT so'rovi to'g'ri `Proxy-Authorization: Bearer
 *     <PROXY_AUTH_TOKEN>` sarlavhasini olib kelishi SHART — bo'lmasa
 *     407 bilan rad etiladi.
 *   - Proksi FAQAT ruxsat etilgan xostlarga (ALLOWED_HOSTS) tunnel
 *     ochadi — token qandaydir sabab bilan sizib chiqsa ham, VM
 *     "ochiq relay" sifatida boshqa (Atmos'ga aloqasi bo'lmagan)
 *     maqsadlarda ishlatilib qolmasligi uchun.
 *   - HTTPS tarkibi (so'rov/javob matni) VM orqali HECH QACHON ochiq
 *     ko'rinmaydi — CONNECT tunnel'dan keyin haqiqiy TLS (shifrlash)
 *     to'g'ridan-to'g'ri Cloud Function <-> Atmos orasida davom etadi,
 *     VM faqat baytlarni ko'r-ko'rona uzatadi (shifrini ochmaydi).
 *
 * O'RNATISH (VM'da, SSH orqali):
 *   1) Eski jarayonni to'xtating:  pkill -f test-server.js  (yoki
 *      `ps aux | grep node` bilan PID topib `kill <PID>`)
 *   2) Shu faylni VM'ga joylashtiring (nano orqali nusxalab yozing,
 *      yoki `gcloud compute scp` bilan ko'chiring), masalan nomi bilan
 *      saqlang: atmos-secure-proxy-server.js
 *   3) Kuchli, tasodifiy token generatsiya qiling (masalan VM'ning
 *      o'zida): openssl rand -hex 32
 *   4) Serverni shu token bilan ishga tushiring (SSH oynasi yopilsa ham
 *      ishlashda davom etsin uchun `nohup` bilan):
 *        PROXY_AUTH_TOKEN="<yuqoridagi tasodifiy qiymat>" \
 *        nohup node atmos-secure-proxy-server.js > proxy.log 2>&1 &
 *   5) Firewall: eski `allow-test-8080` qoidasini 3128-portga mos
 *      qilib o'zgartiring (yoki yangi qoida yarating: tcp:3128,
 *      source 0.0.0.0/0 — yuqorida tushuntirilganidek, IP bo'yicha
 *      cheklash amaliy emas, himoya token orqali).
 *   6) AYNAN SHU tasodifiy tokenni Firebase'da ham saqlang:
 *        firebase functions:secrets:set ATMOS_PROXY_TOKEN
 *      (so'ralganda xuddi shu qiymatni kiriting)
 *   7) Firebase'da proksi manzilini ham sozlang (bu sekret EMAS,
 *      oddiy parametr — `functions/.env.<project>` fayliga qo'shing
 *      yoki deploy paytida so'raladi):
 *        ATMOS_PROXY_URL=http://35.211.129.224:3128
 *   8) `firebase deploy --only functions` — shundan keyin
 *      `atmosClient.js` haqiqiy Atmos so'rovlarini shu proksi orqali
 *      yubora boshlaydi.
 */

const http = require("http");
const net = require("net");
const https = require("https");

const PORT = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : 3128;
const AUTH_TOKEN = process.env.PROXY_AUTH_TOKEN;

// Faqat shu xost(lar)ga CONNECT tunnel ochishga ruxsat beriladi.
// Atmos API'sining o'zi FAQAT shu bitta manzil orqali chaqiriladi
// (`lib/atmosClient.js`dagi `ATMOS_API_BASE`) — shuning uchun standart
// ro'yxat ATAYLAB shu bitta xost bilan chegaralangan. Kerak bo'lsa
// (masalan Atmos yangi API manzil qo'shsa) `PROXY_ALLOWED_HOSTS`
// (vergul bilan ajratilgan) orqali kengaytirish mumkin.
const ALLOWED_HOSTS = new Set(
  (process.env.PROXY_ALLOWED_HOSTS || "apigw.atmos.uz").split(",").map((h) => h.trim()).filter(Boolean)
);

if (!AUTH_TOKEN) {
  console.error(
    "XATO: PROXY_AUTH_TOKEN environment o'zgaruvchisi sozlanmagan. " +
      "Server ATAYLAB ishga tushmaydi (himoyasiz proksi bo'lib qolmasligi uchun)."
  );
  process.exit(1);
}

function isAuthorized(req) {
  const header = req.headers["proxy-authorization"];
  return header === `Bearer ${AUTH_TOKEN}`;
}

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
  if (req.method === "GET" && req.url === "/whoami") {
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
  res.end(JSON.stringify({ ok: false, error: "Topilmadi. /whoami dan foydalaning yoki CONNECT so'rovi yuboring." }));
});

// HTTP CONNECT — haqiqiy forward-proksi (HTTPS tunnel) qismi. `undici`
// ProxyAgent'i aynan shu usulda ishlaydi: `CONNECT apigw.atmos.uz:443
// HTTP/1.1` yuboradi, `Proxy-Authorization` sarlavhasi bilan.
server.on("connect", (req, clientSocket, head) => {
  if (!isAuthorized(req)) {
    console.warn(`Ruxsatsiz CONNECT urinishi rad etildi (${req.url}).`);
    clientSocket.write("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n");
    clientSocket.destroy();
    return;
  }

  const [hostname, portStr] = String(req.url).split(":");
  const port = Number(portStr) || 443;

  if (!ALLOWED_HOSTS.has(hostname)) {
    console.warn(`Ruxsat etilmagan xostga CONNECT so'rovi rad etildi: ${hostname}`);
    clientSocket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    clientSocket.destroy();
    return;
  }

  const serverSocket = net.connect(port, hostname, () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on("error", (err) => {
    console.error(`Maqsad serverga (${hostname}:${port}) ulanishda xatolik:`, err.message);
    clientSocket.destroy();
  });
  clientSocket.on("error", () => serverSocket.destroy());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ATMOS statik-IP proksi ${PORT}-portda ishga tushdi (faqat token bilan CONNECT qabul qilinadi).`);
});
