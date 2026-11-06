import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "FAQ", description: "Answers about BETVANTA predictions, plans, payments and your account." };
const QA = [
  ["How are predictions made?", "A statistical model estimates each team's expected goals from this season's home and away scoring and conceding records, then analysts review the drafts before publishing."],
  ["What do the confidence bands mean?", "They group the model's probability: for match result, high is 60% or more and medium 48% or more; for two-way markets, high is 68% or more and medium 58% or more."],
  ["Can a prediction change after kickoff?", "No. Published picks lock at kickoff in the database and settle against the official final score."],
  ["Do plans renew automatically?", "No. You pay for a fixed period. We email you three days before access ends so you can renew."],
  ["How do I cancel?", "Go to Dashboard, then Billing, then Cancel. You keep access until the end of the period you paid for."],
  ["When does my access start?", "As soon as Paystack confirms the payment to our server. We never unlock access from the payment page alone."],
  ["Is BETVANTA a bookmaker?", "No. We do not take bets or hold funds. We publish analysis only. You must be 18 or older to use BETVANTA."],
  ["Which currency do you charge in?", "All prices are in US dollars."],
];
export default function Faq() {
  return (
    <div className="wrap py-10 max-w-[760px]">
      <PageHeader eyebrow="Help" title="Frequently asked questions" />
      <div className="grid gap-3">{QA.map(([q, a]) => <details key={q} className="card px-5 py-4 group"><summary className="font-semibold cursor-pointer">{q}</summary><p className="mt-2 text-muted">{a}</p></details>)}</div>
    </div>
  );
}
