import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { validWebhookSignature } from "@/lib/services/payments/paystack";
import { verifyAndActivate } from "@/lib/services/billing";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 200_000) return NextResponse.json({ ok: false }, { status: 413 });
  const valid = validWebhookSignature(raw, req.headers.get("x-paystack-signature"));
  let evt: { event?: string; data?: { id?: number; reference?: string } };
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!valid) {
    console.warn("[webhook] invalid Paystack signature");
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const key = `${evt.event}:${evt.data?.id ?? evt.data?.reference}`;
  const ins = await q("insert into webhook_events(provider, event_key, event_type, signature_valid, payload) values ('paystack',$1,$2,true,$3) on conflict do nothing returning id",
    [key, evt.event ?? "unknown", raw]);
  if (!ins.length) return NextResponse.json({ ok: true, duplicate: true }); // replayed event: already handled
  try {
    if (evt.event === "charge.success" && evt.data?.reference) await verifyAndActivate(evt.data.reference, "webhook");
    await q("update webhook_events set processed_at = now() where id = $1", [ins[0].id]);
  } catch (e) {
    await q("update webhook_events set error = $2 where id = $1", [ins[0].id, String(e)]);
  }
  return NextResponse.json({ ok: true });
}
