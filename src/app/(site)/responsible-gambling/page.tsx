import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Responsible gambling" };
export default function RG() {
  return (
    <div className="wrap py-10 max-w-[760px] grid gap-5 text-[15px] leading-7">
      <PageHeader eyebrow="Your wellbeing" title="Responsible gambling">BETVANTA publishes analysis, not guarantees. No prediction removes the risk of losing money.</PageHeader>
      <ul className="grid gap-3 list-disc pl-5">
        <li>Only stake what you can afford to lose, and set a limit before you start.</li>
        <li>Never chase losses or borrow money to bet.</li>
        <li>Take regular breaks, and stop if betting stops being enjoyable.</li>
        <li>You must be 18 or older to use BETVANTA.</li>
      </ul>
      <p>If betting is affecting your life or someone close to you, speak to someone you trust and contact a local support service.</p>
    </div>
  );
}
