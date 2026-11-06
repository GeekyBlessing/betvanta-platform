import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { support } from "@/lib/support";
import { FAQ } from "@/lib/content/faq";
export const metadata: Metadata = { title: "FAQ", description: "Answers about BETVANTA predictions, plans, payments and your account." };
const QA = FAQ;
export default function Faq() {
  const s = support();
  const qa = [...QA, ["How do I contact support?", `Email ${s.email}, call ${s.phoneDisplay}, or use the contact form.`]];
  return (
    <div className="wrap py-10 max-w-[760px]">
      <PageHeader eyebrow="Help" title="Frequently asked questions" />
      <div className="grid gap-3">{qa.map(([q, a]) => <details key={q} className="card px-5 py-4 group"><summary className="font-semibold cursor-pointer">{q}</summary><p className="mt-2 text-muted">{a}</p></details>)}</div>
    </div>
  );
}
