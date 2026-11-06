import type { Metadata } from "next";
import { Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Terms of service" };
export default function Terms() {
  return (
    <div className="wrap py-10 max-w-[760px] grid gap-5 text-[15px] leading-7">
      <PageHeader eyebrow="Legal" title="Terms of service" />
      <Notice tone="warning" title="Draft.">These terms must be reviewed by counsel before BETVANTA takes live payments. The contracting entity, governing law and dispute venue depend on where BETVANTA&apos;s legal entity is registered, which has not been confirmed yet.</Notice>
      <p><strong>Eligibility.</strong> You must be at least 18 years old (or older where local law requires) and allowed to use sports analysis services where you live.</p>
      <p><strong>What we provide.</strong> BETVANTA publishes sports analysis and predictions. We do not accept bets, hold funds, or guarantee any outcome. Decisions you make using our content are your own. Any future betting features would be provided only through a licensed operator, only in US states where that operator is authorized.</p>
      <p><strong>Subscriptions.</strong> Prices are in US dollars. Paid plans give access for a fixed period from the moment the payment is verified. Plans do not renew automatically. Cancelling stops reminders; access continues to the end of the paid period.</p>
      <p><strong>Refunds.</strong> Refund terms will be set out here before live payments open.</p>
      <p><strong>Accounts.</strong> Keep your password private. One account per person. We may suspend accounts that share access, scrape content or abuse the service.</p>
      <p><strong>Content.</strong> Predictions and analysis are for your personal use and may not be resold or republished.</p>
      <p><strong>Governing law.</strong> To be confirmed with the legal entity.</p>
    </div>
  );
}
