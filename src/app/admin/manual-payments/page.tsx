import type { Metadata } from "next";
import Link from "next/link";
import { pageRole } from "@/lib/auth";
import { formatMoney } from "@/lib/services/billing";
import { explorerUrl, isCrypto, listManualPayments, manualPaymentsReady, methodLabel, type ManualPayment } from "@/lib/services/manual-payments";
import { ApiForm, Check } from "@/components/ApiForm";
import { ActionButton } from "@/components/ActionButton";
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
      Payments sent through the payment assistant (crypto to BETVANTA&apos;s wallets, and methods arranged with BETVANTA on Discord). Nothing grants access until you approve it here.
      Approve only after the payment is verified: crypto is checked on the blockchain, other methods need a description of the payment you found. These are subscription payments only and are kept apart from sportsbook wallets.
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
          {isCrypto(r.method) && (
            <div className={`rounded-md px-4 py-3 text-sm grid gap-1 ${r.chain_status === "verified" ? "bg-success-subtle" : r.chain_status === "failed" ? "bg-danger-subtle" : r.chain_status ? "bg-warning-subtle" : "bg-sunken"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <strong>Blockchain check:</strong>
                {r.chain_status === "verified" ? <Badge tone="success" dot>Verified on chain</Badge> : r.chain_status === "failed" ? <Badge tone="danger" dot>Failed</Badge>
                  : r.chain_status === "pending" ? <Badge tone="warning" dot>Waiting for confirmations</Badge> : r.chain_status === "unsupported" ? <Badge tone="warning" dot>Verify by hand</Badge>
                  : r.chain_status === "error" ? <Badge tone="warning" dot>Explorer unavailable</Badge> : <Badge dot>Not checked yet</Badge>}
                {r.chain_checked_at && <span className="text-xs text-subtle">{fmtDate(r.chain_checked_at)}</span>}
                {r.status === "pending_review" && <span className="ml-auto"><ActionButton action={`/api/admin/manual-payments/${r.id}`} payload={{ action: "check" }} label="Check on blockchain" variant="secondary" /></span>}
              </div>
              {r.chain_summary && <p>{r.chain_summary}</p>}
              {r.status === "approved" && <p className="text-xs text-muted">{r.verified_manually ? "Approved after the admin verified the transaction by hand." : "Approved after the on-chain check passed."}</p>}
            </div>)}
          {r.status === "pending_review" ? (
            <div className="grid gap-4 md:grid-cols-2 border-t border-line pt-4">
              <ApiForm action={`/api/admin/manual-payments/${r.id}`} extra={{ action: "approve" }} submitLabel="Approve and grant access" variant="primary" size="sm" className="grid gap-2 content-start">
                <label htmlFor={id("an")} className="label">How you verified the payment</label>
                <textarea id={id("an")} name="note" className="input min-h-[64px]" maxLength={500} aria-describedby={id("ah")}
                  placeholder={isCrypto(r.method) ? "For example: 0.0011 BTC received at bc1q... in tx 3f2a..., 3 confirmations" : "For example: PayPal transaction 9XK21 for $150 received 7 Nov"} />
                <span id={id("ah")} className="text-[13px] text-subtle">{isCrypto(r.method)
                  ? "Approval runs the blockchain check again. It is refused if the check fails or is still waiting for confirmations."
                  : "Required. A screenshot alone is not proof: confirm the money arrived in the account."}</span>
                {isCrypto(r.method) && r.chain_status !== "verified" && <Check name="verifiedManually">I checked this transaction on the blockchain myself and the full amount reached the BETVANTA address. Only needed when the automatic check cannot run.</Check>}
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
