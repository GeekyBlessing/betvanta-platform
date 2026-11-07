import type { Metadata } from "next";
import Link from "next/link";
import { pageRole } from "@/lib/auth";
import { formatMoney } from "@/lib/services/billing";
import { explorerUrl, isCrypto, listManualPayments, manualPaymentsReady, methodLabel, type ManualPayment } from "@/lib/services/manual-payments";
import { ApiForm } from "@/components/ApiForm";
import { Badge, fmtDate, Notice, PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Manual payments" };
export const dynamic = "force-dynamic";

const TABS = [["pending_review", "To review"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]] as const;
const statusBadge = (s: ManualPayment["status"]) => s === "approved" ? <Badge tone="success" dot>Approved</Badge> : s === "rejected" ? <Badge tone="danger" dot>Rejected</Badge> : <Badge tone="warning" dot>Pending verification</Badge>;
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function ManualPayments(props: { searchParams: Promise<{ status?: string }> }) {
  await pageRole("/admin/manual-payments", "admin");
  const sp = await props.searchParams;
  const status = (TABS.find(([k]) => k === sp.status)?.[0] ?? "pending_review");
  if (!(await manualPaymentsReady())) return (<>
    <PageHeader eyebrow="Admin" title="Manual payments" />
    <Notice tone="warning" title="Database update needed.">The manual payments tables (migration 011) are not in the database yet, so the payment assistant is switched off. Run the Supabase check workflow in apply mode, then reload this page.</Notice>
  </>);
  const rows = await listManualPayments(status);
  return (<>
    <PageHeader eyebrow="Admin" title="Manual payments">
      Payments sent through the payment assistant (crypto to BETVANTA&apos;s wallets, and methods arranged by Tom on Discord). Nothing grants access until you approve it here.
      Approve only after you have confirmed the funds arrived in full. These are subscription payments only and are kept apart from sportsbook wallets.
    </PageHeader>
    <nav aria-label="Filter by status" className="flex flex-wrap gap-2 mb-6">
      {TABS.map(([k, l]) => <Link key={k} href={`/admin/manual-payments?status=${k}`} aria-current={k === status ? "page" : undefined}
        className={`rounded-full px-3 py-1.5 text-sm font-semibold border ${k === status ? "bg-brand text-on-brand border-transparent" : "border-line-strong text-muted hover:text-ink"}`}>{l}</Link>)}
    </nav>
    {!rows.length && <Notice>{status === "pending_review" ? "Nothing to review right now." : "No submissions in this list."}</Notice>}
    <div className="grid gap-4">{rows.map((r) => {
      const ex = explorerUrl(r.method, r.network, r.customer_reference);
      const id = (n: string) => `mp-${r.id}-${n}`;
      return (
        <article key={r.id} className="card p-5 grid gap-4" aria-labelledby={id("h")}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={id("h")} className="font-semibold num">{r.reference}</h2>{statusBadge(r.status)}
            <span className="text-xs text-subtle ml-auto">Submitted {fmtDate(r.created_at)}</span>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3 [&_dt]:text-muted [&_dt]:text-xs [&_dd]:font-medium [&_dd]:break-words">
            <div><dt>Plan and amount</dt><dd>{r.plan_name} · <span className="num">{formatMoney(r.amount_minor)}</span></dd></div>
            <div><dt>Method</dt><dd>{methodLabel(r)}{r.network ? ` · ${r.network}` : ""}</dd></div>
            <div><dt>Account</dt><dd>{r.account_name} · {r.account_email}</dd></div>
            <div><dt>Full name</dt><dd>{r.full_name}</dd></div>
            <div><dt>Contact email</dt><dd>{r.contact_email}</dd></div>
            <div><dt>Discord</dt><dd className="num">{r.discord_username}</dd></div>
            {r.pay_to_address && <div className="sm:col-span-2 lg:col-span-3"><dt>Sent to (address shown to the member)</dt><dd className="num text-xs break-all">{r.pay_to_address}</dd></div>}
            <div className="sm:col-span-2 lg:col-span-3"><dt>{isCrypto(r.method) ? "Transaction hash" : "Payment reference"}</dt>
              <dd className="num text-xs break-all">{r.customer_reference ?? "Not given"}{ex && <> · <a href={ex} target="_blank" rel="noopener noreferrer" className="text-link underline">Check on block explorer</a></>}</dd></div>
            {r.customer_note && <div className="sm:col-span-2 lg:col-span-3"><dt>Member&apos;s note</dt><dd className="font-normal">{r.customer_note}</dd></div>}
            <div className="sm:col-span-2 lg:col-span-3"><dt>Proof</dt><dd>{r.proofs.length ? r.proofs.map((f) =>
              <a key={f.id} href={`/api/admin/manual-payments/proofs/${f.id}`} target="_blank" rel="noopener noreferrer" className="text-link underline mr-3">{f.filename} ({kb(f.size_bytes)})</a>) : "No file uploaded"}</dd></div>
          </dl>
          {r.status === "pending_review" ? (
            <div className="grid gap-4 md:grid-cols-2 border-t border-line pt-4">
              <ApiForm action={`/api/admin/manual-payments/${r.id}`} extra={{ action: "approve" }} submitLabel="Approve and grant access" variant="primary" size="sm" className="grid gap-2 content-start">
                <label htmlFor={id("an")} className="label">Approval note <span className="font-normal text-subtle">(optional, internal)</span></label>
                <textarea id={id("an")} name="note" className="input min-h-[64px]" maxLength={500} placeholder="For example: 0.0011 BTC received, 3 confirmations" />
              </ApiForm>
              <ApiForm action={`/api/admin/manual-payments/${r.id}`} extra={{ action: "reject" }} submitLabel="Reject" variant="danger" size="sm" className="grid gap-2 content-start">
                <label htmlFor={id("rn")} className="label">Reason for the member</label>
                <textarea id={id("rn")} name="note" className="input min-h-[64px]" maxLength={500} required placeholder="For example: no payment found for this hash" />
              </ApiForm>
            </div>
          ) : (
            <p className="text-sm text-muted border-t border-line pt-3">{r.status === "approved" ? "Approved" : "Rejected"} {r.reviewed_at ? fmtDate(r.reviewed_at) : ""}{r.reviewer_name ? ` by ${r.reviewer_name}` : ""}{r.review_note ? `: ${r.review_note}` : ""}</p>
          )}
        </article>);
    })}</div>
  </>);
}
