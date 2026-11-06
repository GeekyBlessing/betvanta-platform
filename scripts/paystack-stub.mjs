// Local stand-in for Paystack's API (initialize + verify) for development and end-to-end tests.
// Mark a reference as paid: POST /__pay/<reference> with {"amount":..., "currency":"NGN", "status":"success"}.
import http from "node:http";
const txs = new Map();
const port = Number(process.env.STUB_PORT ?? 4599);
http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    if (req.url.startsWith("/__pay/")) { txs.set(decodeURIComponent(req.url.slice(7)), JSON.parse(b)); return res.end('{"ok":true}'); }
    if (!req.headers.authorization?.startsWith("Bearer sk_test_")) { res.statusCode = 401; return res.end('{"status":false,"message":"Invalid key"}'); }
    if (req.url === "/transaction/initialize") { const j = JSON.parse(b); txs.set(j.reference, { status: "ongoing", amount: j.amount, currency: j.currency }); return res.end(JSON.stringify({ status: true, message: "ok", data: { authorization_url: `http://127.0.0.1:${port}/checkout/${j.reference}`, access_code: "stub", reference: j.reference } })); }
    const m = req.url.match(/^\/transaction\/verify\/(.+)$/);
    if (m) { const ref = decodeURIComponent(m[1]); const t = txs.get(ref); return res.end(JSON.stringify(t ? { status: true, message: "ok", data: { ...t, reference: ref, paid_at: new Date().toISOString() } } : { status: false, message: "Transaction reference not found" })); }
    res.statusCode = 404; res.end("{}");
  });
}).listen(port, "127.0.0.1", () => console.log(`paystack stub on :${port}`));
