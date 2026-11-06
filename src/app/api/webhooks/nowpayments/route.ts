import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { validNowpaymentsSignature, type NpPayment } from "@/lib/services/payments/nowpayments";
import { verifyAndActivate } from "@/lib/services/billing";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 200_000) return NextResponse.json({ ok: false }, { status: 413 });
  let evt: NpPayment;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!validNowpaymentsSignature(evt, req.headers.get("x-nowpayments-sig"))) return NextResponse.json({ ok: false }, { status: 401 });
  const key = `${evt.payment_id}:${evt.payment_status}`;
  const ins = await q("insert into webhook_events(provider, event_key, event_type, signature_valid, payload) values ('nowpayments',$1,$2,true,$3) on conflict do nothing returning id", [key, evt.payment_status, raw]);
  if (!ins.length) return NextResponse.json({ ok: true, duplicate: true });
  try {
    // The IPN tells us the payment id; we still confirm the status with NOWPayments' API before granting access.
    if (/^BV-[A-Z0-9-]+$/.test(evt.order_id)) await verifyAndActivate(evt.order_id, "webhook", { providerPaymentId: String(evt.payment_id) });
    await q("update webhook_events set processed_at = now() where id = $1", [ins[0].id]);
  } catch (e) { await q("update webhook_events set error = $2 where id = $1", [ins[0].id, String(e)]); }
  return NextResponse.json({ ok: true });
}
