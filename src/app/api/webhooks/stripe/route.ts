import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { validStripeSignature } from "@/lib/services/payments/stripe";
import { verifyAndActivate } from "@/lib/services/billing";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 500_000) return NextResponse.json({ ok: false }, { status: 413 });
  if (!validStripeSignature(raw, req.headers.get("stripe-signature"))) return NextResponse.json({ ok: false }, { status: 400 });
  const evt = JSON.parse(raw) as { id: string; type: string; data: { object: { client_reference_id?: string } } };
  const ins = await q("insert into webhook_events(provider, event_key, event_type, signature_valid, payload) values ('stripe',$1,$2,true,$3) on conflict do nothing returning id", [evt.id, evt.type, raw]);
  if (!ins.length) return NextResponse.json({ ok: true, duplicate: true });
  try {
    const ref = evt.data.object.client_reference_id;
    if (ref && ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired"].includes(evt.type)) await verifyAndActivate(ref, "webhook");
    await q("update webhook_events set processed_at = now() where id = $1", [ins[0].id]);
  } catch (e) { await q("update webhook_events set error = $2 where id = $1", [ins[0].id, String(e)]); }
  return NextResponse.json({ ok: true });
}
