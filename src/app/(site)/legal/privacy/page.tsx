import type { Metadata } from "next";
import { Notice, PageHeader } from "@/components/ui";
import { support } from "@/lib/support";
export const metadata: Metadata = { title: "Privacy policy" };
export const dynamic = "force-dynamic";
export default function Privacy() {
  return (
    <div className="wrap py-10 max-w-[760px] grid gap-5 text-[15px] leading-7">
      <PageHeader eyebrow="Legal" title="Privacy policy" />
      <Notice tone="warning" title="Draft.">BETVANTA serves customers primarily in the United States. This policy must be reviewed by counsel once the operating entity and its jurisdiction are confirmed, including applicable US state privacy laws (for example California&apos;s CCPA/CPRA) and any other regions where customers are served.</Notice>
      <p><strong>What we collect.</strong> Your name, email address, hashed password, notification settings, linked Discord account (if you choose to link it), subscription and payment records, and basic security logs (IP address and device on sign-in).</p>
      <p><strong>Why.</strong> To run your account, verify payments, send service emails, protect the platform from abuse, and meet legal and accounting duties.</p>
      <p><strong>Service providers.</strong> Payment processors (such as Stripe), our email provider (Resend), Discord (only if you link it), and our hosting and database providers. Card details are handled by the payment processor and never reach BETVANTA.</p>
      <p><strong>Your choices.</strong> You can update your details, unlink Discord, change email preferences and delete your account from Settings. Deleting your account removes your personal details; payment records are kept without them for accounting.</p>
      <p><strong>Cookies.</strong> We use one essential, secure session cookie to keep you signed in. No advertising cookies. We do not sell personal information.</p>
      <p><strong>Contact.</strong> Questions about this page: <a className="text-link underline" href={support().emailHref}>{support().email}</a> or <a className="text-link underline" href={support().phoneHref}>{support().phoneDisplay}</a>.</p>
    </div>
  );
}
