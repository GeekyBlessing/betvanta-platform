import type { Metadata } from "next";
import { pageUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { CONSENT_TEXT } from "@/lib/services/testimonials";
import { ApiForm, Check, Field } from "@/components/ApiForm";
import { ActionButton } from "@/components/ActionButton";
import { Badge, fmtDate, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Share feedback" };
export default async function Feedback() {
  const u = await pageUser("/dashboard/feedback");
  const mine = await q("select id, rating, body, status, created_at from testimonials where user_id = $1 order by created_at desc", [u.id]);
  const tone = (s: string) => (s === "approved" ? "success" : s === "pending" ? "warning" : "neutral") as "success";
  return (<>
    <PageHeader eyebrow="Feedback" title="Share your experience">Tell other fans what BETVANTA is like. Reviews are checked by our team before they appear, and you can withdraw yours at any time.</PageHeader>
    <div className="grid gap-6 max-w-[640px]">
      <section className="card p-6 grid gap-4">
        <ApiForm action="/api/testimonials" submitLabel="Submit review" resetOnSuccess>
          <Field label="Name to show" name="displayName" defaultValue={u.display_name.split(" ")[0]} hint="A first name or initials is fine." required />
          <Field label="Location (optional)" name="location" placeholder="e.g. Austin, TX" />
          <fieldset className="grid gap-2"><legend className="label mb-1">Rating</legend>
            <div className="flex gap-3 flex-wrap">{[5, 4, 3, 2, 1].map((n) => <label key={n} className="flex items-center gap-1.5 text-sm"><input type="radio" name="rating" value={n} defaultChecked={n === 5} className="accent-[var(--primary)]" />{n} star{n > 1 ? "s" : ""}</label>)}</div>
          </fieldset>
          <div className="grid gap-1.5"><label htmlFor="f-body" className="label">Your review</label><textarea id="f-body" name="body" rows={5} maxLength={600} className="input" required /></div>
          <Check name="consent">{CONSENT_TEXT}</Check>
        </ApiForm>
      </section>
      {mine.length > 0 && <section className="grid gap-3"><h2 className="font-semibold text-[17px]">Your reviews</h2>
        {mine.map((t) => <div key={t.id} className="card p-4 grid gap-2"><div className="flex gap-2 items-center flex-wrap"><Badge tone={tone(t.status)} dot>{t.status}</Badge><span className="text-xs text-subtle">{fmtDate(t.created_at)} · {t.rating} of 5</span></div><p className="text-sm">{t.body}</p>
          {["pending", "approved"].includes(t.status) && <div><ActionButton action={`/api/testimonials/${t.id}`} method="DELETE" label="Withdraw" variant="ghost" confirmText="Confirm withdraw" /></div>}</div>)}
      </section>}
    </div>
  </>);
}
