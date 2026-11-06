import http from "node:http";
// In-process stand-in for Paystack, Stripe and NOWPayments APIs. Tests set what each provider "reports".
export const state = { paystack: new Map<string, { status: string; amount: number; currency: string }>(), stripe: new Map<string, { payment_status: string; status: string; amount_total: number; currency: string; ref: string }>(), np: new Map<string, { payment_status: string; price_amount: number; price_currency: string; order_id: string }>() };
let n = 0;
export function startStub(port: number) {
  const server = http.createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      res.setHeader("content-type", "application/json");
      const url = req.url!, auth = req.headers.authorization ?? "";
      if (url.startsWith("/transaction/")) {
        if (auth !== "Bearer sk_test_unit_secret") { res.statusCode = 401; return res.end('{"status":false,"message":"bad key"}'); }
        if (url === "/transaction/initialize") { const j = JSON.parse(b); return res.end(JSON.stringify({ status: true, message: "ok", data: { authorization_url: `https://checkout.paystack.com/${j.reference}`, reference: j.reference } })); }
        const ref = decodeURIComponent(url.split("/").pop()!); const t = state.paystack.get(ref);
        return res.end(JSON.stringify(t ? { status: true, message: "ok", data: { ...t, reference: ref } } : { status: false, message: "not found" }));
      }
      if (url.startsWith("/v1/checkout/sessions")) {
        if (auth !== "Bearer sk_test_stripe_unit") { res.statusCode = 401; return res.end('{"error":{"message":"bad key"}}'); }
        if (req.method === "POST") { const f = new URLSearchParams(b); const id = `cs_test_${++n}`; state.stripe.set(id, { payment_status: "unpaid", status: "open", amount_total: Number(f.get("line_items[0][price_data][unit_amount]")), currency: f.get("line_items[0][price_data][currency]")!, ref: f.get("client_reference_id")! }); return res.end(JSON.stringify({ id, url: `https://checkout.stripe.com/c/pay/${id}` })); }
        const id = decodeURIComponent(url.split("/").pop()!); const s = state.stripe.get(id);
        return res.end(JSON.stringify({ id, url: "", payment_status: s!.payment_status, status: s!.status, amount_total: s!.amount_total, currency: s!.currency, client_reference_id: s!.ref }));
      }
      if (url.startsWith("/v1/invoice") || url.startsWith("/v1/payment/")) {
        if (req.headers["x-api-key"] !== "np_unit") { res.statusCode = 401; return res.end('{"message":"bad key"}'); }
        if (url === "/v1/invoice") { const j = JSON.parse(b); return res.end(JSON.stringify({ id: `inv_${++n}`, invoice_url: `https://nowpayments.io/payment/?iid=${n}`, echo: j })); }
        const id = decodeURIComponent(url.split("/").pop()!); const p = state.np.get(id);
        if (!p) { res.statusCode = 404; return res.end('{"message":"not found"}'); }
        return res.end(JSON.stringify({ payment_id: id, ...p }));
      }
      res.statusCode = 404; res.end("{}");
    });
  });
  return new Promise<http.Server>((r) => server.listen(port, "127.0.0.1", () => r(server)));
}
