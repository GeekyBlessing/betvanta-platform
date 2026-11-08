import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { levelFor, tierFor } from "@/lib/services/entitlements";
import { featuresUpTo } from "@/lib/services/plans";
import { listPredictions } from "@/lib/services/predictions";
import { ApiForm } from "@/components/ApiForm";
import { FixtureCard, groupByFixture } from "@/components/PredictionCard";
import { fmtDate, Notice, PageHeader, Stat, tierBadge } from "@/components/ui";
export const metadata: Metadata = { title: "Dashboard" };
export default async function Dashboard() {
  const u = await pageUser("/dashboard");
  const tier = await tierFor(u);
  const level = await levelFor(u);
  const sub = await one<{ current_period_end: string; status: string; name: string; is_lifetime: boolean }>(
    `select s.current_period_end, s.status, p.name, s.is_lifetime from subscriptions s join plans p on p.id = s.plan_id
     where s.user_id = $1 and s.status in ('active','cancelled') and s.current_period_end > now() order by s.plan_level desc, s.current_period_end desc limit 1`, [u.id]);
  const favs = await q<{ id: string; name: string }>("select c.id, c.name from user_favourite_competitions uf join competitions c on c.id = uf.competition_id where uf.user_id = $1 order by c.name", [u.id]);
  const favNames = new Set(favs.map((f) => f.name));
  const all = (await listPredictions(tier, { upcoming: true, limit: 120 })).filter((p) => !p.locked);
  const preds = groupByFixture(favs.length ? all.filter((p) => favNames.has(p.competition)) : all).slice(0, 4);
  return (
    <>
      <PageHeader eyebrow="Overview" title={`Welcome, ${u.display_name}`} />
      {!u.email_verified_at && (
        <div className="mb-6 card p-4 grid gap-3 bg-warning-subtle border-transparent">
          <p className="text-sm"><strong>Verify your email.</strong> Check your inbox for the BETVANTA verification link. You need a verified email to subscribe.</p>
          <ApiForm action="/api/auth/resend-verification" submitLabel="Resend verification email" variant="secondary" size="sm" className="grid gap-2" />
        </div>)}
      <div className="grid gap-3 md:grid-cols-3 mb-8">
        <div className="card p-5 grid gap-2"><span className="text-[13px] font-medium text-muted">Your access</span><span>{tierBadge(tier)}</span><span className="text-xs text-subtle">{sub ? (sub.is_lifetime ? `${sub.name}, lifetime access` : `${sub.name}, ${sub.status === "cancelled" ? "ends" : "until"} ${fmtDate(sub.current_period_end)}`) : u.role !== "member" ? "Staff access" : "Free plan"}</span></div>
        <Stat label="Predictions available to you" value={String(preds.length)} foot="Upcoming fixtures" />
        <div className="card p-5 grid gap-3 content-start"><span className="text-[13px] font-medium text-muted">Plan</span>{tier === "free" ? <Link href="/packages" className="btn btn-accent">Upgrade to Premium</Link> : <Link href="/dashboard/billing" className="btn btn-secondary">Manage billing</Link>}</div>
      </div>
      {level > 0 && (
        <section className="card p-6 grid gap-3 mb-8">
          <h2 className="font-semibold text-[17px]">Your plan benefits</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">{featuresUpTo(level).map((f) => <li key={f.key} className="flex gap-2"><span aria-hidden className="text-link">✓</span><span>{f.label}{f.delivery === "team" && <span className="text-subtle"> (via the BETVANTA team on Discord or by email)</span>}</span></li>)}</ul>
        </section>)}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <h2 className="font-semibold text-[17px]">Next up for you{favs.length ? <span className="text-sm text-subtle font-normal"> · {favs.map((f) => f.name).join(", ")}</span> : null}</h2>
        <Link href="/sports" className="text-sm font-semibold text-link hover:underline">{favs.length ? "Edit my leagues" : "Choose your leagues"}</Link>
      </div>
      {preds.length ? <div className="grid gap-4 xl:grid-cols-2">{preds.map((g) => <FixtureCard key={g[0].fixture_id} preds={g} />)}</div> : <Notice>No upcoming predictions in your plan yet.</Notice>}
    </>
  );
}
