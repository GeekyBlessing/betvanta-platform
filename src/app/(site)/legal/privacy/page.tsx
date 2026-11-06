import type { Metadata } from "next";
import { Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Privacy policy" };
export default function Privacy() {
  return (
    <div className="wrap py-10 max-w-[760px] grid gap-5 text-[15px] leading-7">
      <PageHeader eyebrow="Legal" title="Privacy policy" />
      <Notice tone="warning" title="Draft.">This policy must be reviewed against the Nigeria Data Protection Act 2023 before launch.</Notice>
      <p><strong>What we collect.</strong> Your name, email address, hashed password, notification settings, subscription and payment records, and basic security logs (IP address and device on sign-in).</p>
      <p><strong>Why.</strong> To run your account, verify payments, send service emails, protect the platform from abuse, and meet legal and accounting duties.</p>
      <p><strong>Processors.</strong> Paystack (payments), Resend (email), our hosting and database providers. Card details are handled by Paystack and never reach BETVANTA.</p>
      <p><strong>Your rights.</strong> You can update your details and delete your account from Settings. Deleting your account removes your personal details; payment records are kept without your personal details for accounting.</p>
      <p><strong>Cookies.</strong> We use one essential, secure session cookie to keep you signed in. No advertising cookies.</p>
    </div>
  );
}
