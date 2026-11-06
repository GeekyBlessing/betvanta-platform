import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { tierFor } from "@/lib/services/entitlements";
import { listPredictions } from "@/lib/services/predictions";
import { ApiForm } from "@/components/ApiForm";
import { FixtureCard, groupByFixture } from "@/components/PredictionCard";
import { fmtDate, Notice, PageHeader, Stat, tierBadge } from "@/components/ui";
export const metadata: Metadata = { title: "Dashboard" };
export default async function Dashboard() {
  const u = await pageUser("/dashboard");
  const tier = await tierFor(u);
  const sub = await one<{ current_period_end: string; status: string; name: string; interval: string }>(
    `select s.current_period_end, s.status, p.name, p.interval from subscriptions s join plans p on p.id = s.plan_id
     where s.user_id = $1 and s.status in ('active','cancelled') and s.current_period_end > now() order by s.current_period_end desc limit 1`, [u.id]);
  const preds = groupByFixture((await listPredictions(tier, { upcoming: true, limit: 60 })).filter((p) => !p.locked)).slice(0, 4);
  return (
    <>
      <PageHeader eyebrow="Overview" title={`Welcome, ${u.display_name}`} />
      {!u.email_verified_at && (
        <div className="mb-6 card p-4 grid gap-3 bg-warning-subtle border-transparent">
          <p className="text-sm"><strong>Verify your email.</strong> Check your inbox for the BETVANTA verification link. You need a verified email to subscribe.</p>
          <ApiForm action="/api/auth/resend-verification" submitLabel="Resend verification email" variant="secondary" size="sm" className="grid gap-2" />
        </div>)}
      <div className="grid gap-3 md:grid-cols-3 mb-8">
        <div className="card p-5 grid gap-2"><span className="text-[13px] font-medium text-muted">Your access</span><span>{tierBadge(tier)}</span><span className="text-xs text-subtle">{sub ? `${sub.name} ${sub.interval}, ${sub.status === "cancelled" ? "ends" : "until"} ${fmtDate(sub.current_period_end)}` : u.role !== "member" ? "Staff access" : "Free plan"}</span></div>
        <Stat label="Predictions available to you" value={String(preds.length)} foot="Upcoming fixtures" />
        <div className="card p-5 grid gap-3 content-start"><span className="text-[13px] font-medium text-muted">Plan</span>{tier === "free" ? <Link href="/pricing" className="btn btn-accent">Upgrade to Premium</Link> : <Link href="/dashboard/billing" className="btn btn-secondary">Manage billing</Link>}</div>
      </div>
      <h2 className="font-semibold text-[17px] mb-3">Next up for you</h2>
      {preds.length ? <div className="grid gap-4 xl:grid-cols-2">{preds.map((g) => <FixtureCard key={g[0].fixture_id} preds={g} />)}</div> : <Notice>No upcoming predictions in your plan yet.</Notice>}
    </>
  );
}
