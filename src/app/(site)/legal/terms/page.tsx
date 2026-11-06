import type { Metadata } from "next";
import { Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Terms of service" };
export default function Terms() {
  return (
    <div className="wrap py-10 max-w-[760px] grid gap-5 text-[15px] leading-7">
      <PageHeader eyebrow="Legal" title="Terms of service" />
      <Notice tone="warning" title="Draft.">These terms are a working draft and must be reviewed by a qualified lawyer before BETVANTA takes live payments.</Notice>
      <p><strong>Eligibility.</strong> You must be at least 18 years old and allowed to use sports prediction services where you live.</p>
      <p><strong>What we provide.</strong> BETVANTA publishes sports analysis and predictions. We do not accept bets, hold funds, or guarantee any outcome. Decisions you make using our content are your own.</p>
      <p><strong>Subscriptions.</strong> Paid plans give access for a fixed period from the moment the payment is verified. Plans do not renew automatically. Cancelling stops reminders; access continues to the end of the paid period.</p>
      <p><strong>Refunds.</strong> Refund terms will be set out here before live payments open.</p>
      <p><strong>Accounts.</strong> Keep your password private. One account per person. We may suspend accounts that share access, scrape content or abuse the service.</p>
      <p><strong>Content.</strong> Predictions and analysis are for your personal use and may not be resold or republished.</p>
    </div>
  );
}
