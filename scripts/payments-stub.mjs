// Local stand-in for the Paystack, Stripe and NOWPayments APIs, for development and end-to-end tests only.
// Mark a payment as paid:  POST /__pay/<reference>  {"status":"success"}   (works for all three providers)
import http from "node:http";
const port = Number(process.env.STUB_PORT ?? 4599);
const byRef = new Map(); // reference -> { provider, amount, currency, status, sessionId, paymentId }
let n = 0;
http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    res.setHeader("content-type", "application/json");
    const url = req.url, send = (o, s = 200) => { res.statusCode = s; res.end(JSON.stringify(o)); };
    if (url.startsWith("/__pay/")) { const ref = decodeURIComponent(url.slice(7)); const t = byRef.get(ref); if (!t) return send({ ok: false }, 404); Object.assign(t, JSON.parse(b || "{}")); return send({ ok: true, paymentId: t.paymentId }); }
    if (url === "/transaction/initialize") { const j = JSON.parse(b); byRef.set(j.reference, { provider: "paystack", amount: j.amount, currency: j.currency, status: "ongoing" }); return send({ status: true, message: "ok", data: { authorization_url: `http://127.0.0.1:${port}/pay/${j.reference}`, reference: j.reference } }); }
    if (url.startsWith("/transaction/verify/")) { const ref = decodeURIComponent(url.split("/").pop()); const t = byRef.get(ref); return send(t ? { status: true, message: "ok", data: { status: t.status, amount: t.amount, currency: t.currency, reference: ref } } : { status: false, message: "not found" }); }
    if (url === "/v1/checkout/sessions" && req.method === "POST") { const f = new URLSearchParams(b); const id = `cs_test_${++n}`; const ref = f.get("client_reference_id"); byRef.set(ref, { provider: "stripe", sessionId: id, amount: Number(f.get("line_items[0][price_data][unit_amount]")), currency: f.get("line_items[0][price_data][currency]"), status: "open" }); return send({ id, url: `http://127.0.0.1:${port}/pay/${ref}` }); }
    if (url.startsWith("/v1/checkout/sessions/")) { const id = decodeURIComponent(url.split("/").pop()); const [ref, t] = [...byRef].find(([, v]) => v.sessionId === id) ?? []; if (!t) return send({ error: { message: "no such session" } }, 404); return send({ id, payment_status: t.status === "success" ? "paid" : "unpaid", status: t.status === "success" ? "complete" : "open", amount_total: t.amount, currency: t.currency, client_reference_id: ref }); }
    if (url === "/v1/invoice") { const j = JSON.parse(b); const paymentId = String(9000 + ++n); byRef.set(j.order_id, { provider: "nowpayments", amount: j.price_amount, currency: j.price_currency, status: "waiting", paymentId }); return send({ id: `inv_${n}`, invoice_url: `http://127.0.0.1:${port}/pay/${j.order_id}` }); }
    if (url.startsWith("/v1/payment/")) { const id = decodeURIComponent(url.split("/").pop()); const [ref, t] = [...byRef].find(([, v]) => v.paymentId === id) ?? []; if (!t) return send({ message: "not found" }, 404); return send({ payment_id: id, payment_status: t.status === "success" ? "finished" : t.status, price_amount: t.amount, price_currency: t.currency, order_id: ref }); }
    send({}, 404);
  });
}).listen(port, "127.0.0.1", () => console.log(`payments stub on :${port}`));
