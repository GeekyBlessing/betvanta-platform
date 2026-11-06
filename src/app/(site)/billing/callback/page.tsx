import Link from "next/link";
import { z } from "zod";
import { pageUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { verifyAndActivate } from "@/lib/services/billing";
import { Notice, PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";

/** Paystack redirects here. We verify with Paystack's API server-side; the redirect alone never grants access. */
export default async function Callback(props: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await pageUser("/dashboard/billing");
  const ref = z.string().regex(/^BV-[A-Z0-9-]+$/).safeParse(searchParams.reference ?? searchParams.trxref);
  let outcome = "invalid";
  if (ref.success) {
    const owns = await one("select 1 from payments where reference = $1 and user_id = $2", [ref.data, user.id]);
    if (owns) { try { outcome = (await verifyAndActivate(ref.data, "callback")).outcome; } catch { outcome = "error"; } }
  }
  const view: Record<string, [string, "success" | "warning" | "danger", string]> = {
    activated: ["Payment verified", "success", "Your plan is active. Premium content is unlocked."],
    already_processed: ["Payment verified", "success", "Your plan is active."],
    pending: ["Payment still processing", "warning", "Paystack has not confirmed this payment yet. Refresh in a minute; we will also activate it automatically when confirmation arrives."],
    failed: ["Payment not completed", "danger", "The payment did not go through. You have not been charged for access. Try again from Pricing."],
    flagged: ["Payment under review", "warning", "The amount received does not match the plan price, so we did not activate it. Our team will review it and contact you."],
    invalid: ["Payment not found", "danger", "We could not find this payment on your account."],
    error: ["We could not confirm the payment", "warning", "Paystack could not be reached. Your payment is safe; refresh this page shortly."],
  };
  const [title, tone, text] = view[outcome];
  return (
    <div className="wrap py-12 max-w-[640px] grid gap-6">
      <PageHeader eyebrow="Billing" title={title} />
      <Notice tone={tone}>{text}</Notice>
      <div className="flex gap-3"><Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link><Link href="/dashboard/billing" className="btn btn-secondary">View billing</Link></div>
    </div>
  );
}
