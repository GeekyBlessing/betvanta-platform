import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "About", description: "BETVANTA is a sports technology company building transparent, data-driven match intelligence." };
export default function About() {
  return (
    <div className="wrap py-10 max-w-[760px]">
      <PageHeader eyebrow="About" title="Sports intelligence you can check">BETVANTA is a sports technology company. We publish match predictions built from data, show the numbers behind them, and keep an open record of every result.</PageHeader>
      <div className="grid gap-6 text-[16px] leading-7">
        <p>Our prediction engine models how many goals each side is likely to score from its home and away record this season, then converts that into probabilities for the match result, both teams to score, and total goals. Analysts review drafts before anything is published.</p>
        <p>We do not sell certainty. Every prediction shows a probability and a confidence band, states what the data does not cover, and locks at kickoff so the record cannot be rewritten.</p>
        <p>BETVANTA is for adults aged 18 and over. Predictions are analysis, not financial advice or guarantees.</p>
      </div>
    </div>
  );
}
