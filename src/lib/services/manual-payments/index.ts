import crypto from "node:crypto";
import { z } from "zod";
import { one, q, tx } from "../../db";
import { audit } from "../../audit";
import { adminEmails, env } from "../../env";
import { sendEmail, templates } from "../../email";
import { badRequest, conflict, notFound, unavailable } from "../../errors";
import { columnExists, tableExists } from "../../schema";
import { rateLimit } from "../../rate-limit";
import { formatMoney, grantAccess } from "../billing";
import { syncDiscordRoleSafe } from "../discord";
import { cryptoReadiness, isCrypto, MANUAL_METHODS, METHOD_LABELS, walletNetwork, WALLETS, type ManualMethod } from "./methods";
import { checkOnChain, type ChainResult } from "./chain";

export * from "./methods";

/** False until migrations 011 and 014 are applied; the assistant, billing and admin then show a notice instead of failing. */
export const manualPaymentsReady = async () => (await tableExists("public.manual_payments")) && (await columnExists("manual_payments", "chain_status"));

export const MAX_PROOF_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
const REF_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U: easy to read out on Discord

export function newReference() {
  const b = crypto.randomBytes(8);
  return "BV-M-" + Array.from(b, (x) => REF_CHARS[x % 32]).join("");
}

/** Detects the real file type from its first bytes; the browser's claimed type and the file name are not trusted. */
export function sniffProof(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | "application/pdf" | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" } as const;

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
export const submissionSchema = z.object({
  planCode: z.string().regex(/^[a-z0-9_]{3,40}$/),
  method: z.enum(MANUAL_METHODS),
  methodOther: opt(40),
  network: opt(40),
  fullName: z.string().trim().min(2, "Enter your full name.").max(100),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  discordUsername: z.string().trim().transform((v) => v.replace(/^@/, "")).pipe(z.string().regex(/^[A-Za-z0-9_.]{2,32}(#\d{4})?$/, "Enter your Discord username, for example tom_bv.")),
  reference: opt(200),
  note: opt(1000),
});
export type Submission = z.infer<typeof submissionSchema>;
export type ProofFile = { name: string; data: Buffer } | null;

export type ManualPayment = {
  id: string; reference: string; user_id: string; plan_id: string; plan_name: string; plan_code: string; amount_minor: string; method: ManualMethod;
  method_other: string | null; network: string | null; pay_to_address: string | null; full_name: string; contact_email: string; discord_username: string;
  customer_reference: string | null; customer_note: string | null; status: "pending_review" | "approved" | "rejected"; review_note: string | null;
  chain_status: "verified" | "failed" | "pending" | "unsupported" | "error" | null; chain_summary: string | null; chain_checked_at: string | null; verified_manually: boolean;
  reviewed_at: string | null; reviewer_name: string | null; created_at: string; account_email: string; account_name: string;
  proofs: { id: string; filename: string; mime: string; size_bytes: number }[];
};

const SELECT = `select m.*, p.name plan_name, p.code plan_code, u.email account_email, u.display_name account_name, r.display_name reviewer_name,
  coalesce((select json_agg(json_build_object('id', f.id, 'filename', f.filename, 'mime', f.mime, 'size_bytes', f.size_bytes) order by f.created_at)
            from manual_payment_proofs f where f.manual_payment_id = m.id), '[]') proofs
  from manual_payments m join plans p on p.id = m.plan_id join users u on u.id = m.user_id left join users r on r.id = m.reviewed_by`;

export const methodLabel = (m: Pick<ManualPayment, "method" | "method_other">) => (m.method === "other" && m.method_other ? m.method_other : METHOD_LABELS[m.method]);

/** Records a member's payment details for review. Never grants access. */
export async function submitManualPayment(user: { id: string; email: string; display_name: string }, input: Submission, proof: ProofFile) {
  if (!(await manualPaymentsReady())) throw unavailable("The payment assistant is not available yet. Please pay by card or contact BETVANTA on Discord.");
  await rateLimit(`manual-pay:${user.id}`, 6, 3600);
  const plan = await one<{ id: string; name: string; amount_minor: string; currency: string }>("select id, name, amount_minor, currency from plans where code = $1 and active", [input.planCode]);
  if (!plan) throw notFound("That plan is not available.");
  if (plan.currency !== "USD") throw badRequest("This plan is not priced in USD.");

  const coin = isCrypto(input.method);
  if (coin) {
    const r = cryptoReadiness(input.method as keyof typeof WALLETS);
    if (!r.ready) throw badRequest(r.reason === "crypto_off" ? "Crypto payments are not open yet. Contact BETVANTA on Discord to pay another way."
      : "This coin's network has not been confirmed yet, so it cannot be used. Contact BETVANTA on Discord to pay another way.");
  }
  if (input.method === "other" && (!input.methodOther || input.methodOther.length < 2)) throw badRequest("Tell us which payment method you used.", { methodOther: ["Enter the payment method, for example Cash App."] });
  // The address and network come only from BETVANTA's verified configuration, never from the customer.
  const address = coin ? WALLETS[input.method as keyof typeof WALLETS].address : null;
  const network = coin ? walletNetwork(input.method as keyof typeof WALLETS) : null;
  if (!input.reference && !proof) throw badRequest(coin ? "Add the transaction hash (TXID) or upload a screenshot of the payment." : "Add the payment ID or upload a screenshot of the payment.",
    { reference: ["Add a transaction or payment reference, or upload proof."] });

  let file: { name: string; mime: string; data: Buffer; sha: string } | null = null;
  if (proof) {
    if (proof.data.length === 0) throw badRequest("The uploaded file is empty.");
    if (proof.data.length > MAX_PROOF_BYTES) throw badRequest("Proof files can be up to 4 MB. Upload a smaller screenshot.", { proof: ["Maximum 4 MB."] });
    const mime = sniffProof(proof.data);
    if (!mime) throw badRequest("Upload a PNG, JPG, WebP or PDF file.", { proof: ["Only PNG, JPG, WebP or PDF files are accepted."] });
    const base = proof.name.replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 80) || "proof";
    file = { name: `${base}.${EXT[mime]}`, mime, data: proof.data, sha: sha256Hex(proof.data) };
  }

  const reference = newReference();
  const row = await tx(async (c) => {
    const open = await one<{ reference: string }>("select reference from manual_payments where user_id = $1 and plan_id = $2 and status = 'pending_review'", [user.id, plan.id], c);
    if (open) throw conflict(`You already sent payment details for this plan (reference ${open.reference}). We will review them shortly.`);
    const m = await one<{ id: string; created_at: string }>(
      `insert into manual_payments(reference, user_id, plan_id, amount_minor, currency, method, method_other, network, pay_to_address, full_name, contact_email, discord_username, customer_reference, customer_note)
       values ($1,$2,$3,$4,'USD',$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id, created_at`,
      [reference, user.id, plan.id, plan.amount_minor, input.method, input.method === "other" ? input.methodOther : null, network, address,
       input.fullName, input.email, input.discordUsername, input.reference ?? null, input.note ?? null], c);
    if (file) await q("insert into manual_payment_proofs(manual_payment_id, filename, mime, size_bytes, sha256, data) values ($1,$2,$3,$4,$5,$6)",
      [m!.id, file.name, file.mime, file.data.length, file.sha, file.data], c);
    await audit(user.id, "billing.manual_payment_submitted", "manual_payment", reference, { method: input.method, plan: plan.name, amount: plan.amount_minor, proof: Boolean(file) }, null, c);
    return m!;
  });

  const amount = formatMoney(plan.amount_minor);
  const label = input.method === "other" ? input.methodOther! : METHOD_LABELS[input.method];
  await sendEmail({ to: user.email, ...templates.manualReceived(user.display_name, plan.name, amount, label, reference) });
  for (const to of adminEmails()) await sendEmail({ to, ...templates.manualToReview(plan.name, amount, label, reference, `${env().APP_URL}/admin/manual-payments`) });
  return { reference, status: "pending_review" as const, createdAt: row.created_at };
}
function sha256Hex(b: Buffer) { return crypto.createHash("sha256").update(b).digest("hex"); }

export const listMyManualPayments = (userId: string) => q<ManualPayment>(`${SELECT} where m.user_id = $1 order by m.created_at desc`, [userId]);
export const pendingForPlan = (userId: string, planCode: string) =>
  one<ManualPayment>(`${SELECT} where m.user_id = $1 and p.code = $2 and m.status = 'pending_review'`, [userId, planCode]);
export const listManualPayments = (status: "pending_review" | "approved" | "rejected" | "all") =>
  q<ManualPayment>(`${SELECT} where ($1 = 'all' or m.status = $1) order by case when m.status = 'pending_review' then m.created_at end asc, m.created_at desc limit 200`, [status]);

type Row = { id: string; reference: string; user_id: string; plan_id: string; status: string; amount_minor: string; method: string; network: string | null; customer_reference: string | null; chain_status: string | null };

/** Runs the on-chain check for a crypto submission and stores the result for the admin. Read-only on the blockchain. */
export async function checkManualPayment(adminId: string, id: string): Promise<ChainResult> {
  const m = await one<Row>("select * from manual_payments where id = $1", [id]);
  if (!m) throw notFound("Submission not found.");
  if (!isCrypto(m.method)) throw badRequest("Only crypto payments can be checked on the blockchain.");
  if (m.status !== "pending_review") throw conflict("This submission has already been decided.");
  const r = await checkOnChain(m);
  await q("update manual_payments set chain_status = $2, chain_summary = $3, chain_details = $4, chain_checked_at = now(), updated_at = now() where id = $1",
    [id, r.status, r.summary.slice(0, 500), r.details ? JSON.stringify(r.details) : null]);
  await audit(adminId, "admin.manual_payment_chain_check", "manual_payment", m.reference, { status: r.status, summary: r.summary });
  return r;
}

export type ApproveInput = { note: string | null; verifiedManually?: boolean };

/**
 * Approves a submission and grants access in the same transaction, only after the payment is verified:
 *  - Crypto: the on-chain check must pass. If it cannot run automatically (another network, no API key, no hash),
 *    the admin must state they verified the transaction on the blockchain and describe how. A failed or unconfirmed
 *    check can never be approved. One transaction can activate only one subscription.
 *  - Other methods: the admin must describe the payment they found (for example the PayPal transaction ID).
 * An uploaded screenshot on its own is never enough.
 */
export async function approveManualPayment(adminId: string, id: string, input: ApproveInput | string | null) {
  const { note, verifiedManually = false } = typeof input === "object" && input !== null ? input : { note: input as string | null };
  const pre = await one<Row>("select * from manual_payments where id = $1", [id]);
  if (!pre) throw notFound("Submission not found.");
  if (pre.status !== "pending_review") throw conflict(`This submission was already ${pre.status === "approved" ? "approved" : "rejected"}.`);
  const coin = isCrypto(pre.method);
  let chain: ChainResult | null = null;
  if (coin) {
    chain = await checkOnChain(pre);
    await q("update manual_payments set chain_status = $2, chain_summary = $3, chain_details = $4, chain_checked_at = now() where id = $1",
      [id, chain.status, chain.summary.slice(0, 500), chain.details ? JSON.stringify(chain.details) : null]);
    if (chain.status === "failed") throw badRequest(`Blockchain check failed: ${chain.summary} Reject this submission instead.`);
    if (chain.status === "pending") throw badRequest(`Not confirmed yet: ${chain.summary}`);
    if (chain.status !== "verified") {
      if (!verifiedManually || !note || note.trim().length < 20)
        throw badRequest(`The automatic check could not confirm this payment (${chain.summary}) Verify it on the blockchain yourself, tick the confirmation box and describe what you saw (at least 20 characters).`, { note: ["Describe how you verified the transaction."] });
    }
    if (pre.customer_reference) {
      const used = await one<{ reference: string }>("select reference from manual_payments where method = $1 and lower(customer_reference) = lower($2) and status = 'approved'", [pre.method, pre.customer_reference]);
      if (used) throw conflict(`This transaction already activated ${used.reference}. One payment can activate only one plan.`);
    }
  } else if (!note || note.trim().length < 10) {
    throw badRequest("Describe the payment you found before approving (for example the PayPal transaction ID and amount).", { note: ["Describe how you verified the payment (at least 10 characters)."] });
  }
  const manual = coin && chain?.status !== "verified";
  const r = await tx(async (c) => {
    const m = await one<Row>("select * from manual_payments where id = $1 for update", [id], c);
    if (!m || m.status !== "pending_review") throw conflict("This submission was already decided.");
    const sub = await grantAccess(c, m.user_id, m.plan_id, "payment", adminId, `Manual payment ${m.reference} (${m.method})`);
    await q("update manual_payments set status = 'approved', reviewed_by = $2, reviewed_at = now(), review_note = $3, subscription_id = $4, verified_manually = $5, updated_at = now() where id = $1",
      [id, adminId, note, sub.id, manual], c);
    await audit(adminId, "admin.manual_payment_approved", "manual_payment", m.reference, { user: m.user_id, plan: sub.planLabel, amount: m.amount_minor, method: m.method, subscription: sub.id, note,
      verification: coin ? (manual ? "admin_attested" : "on_chain") : "admin_described", chain: chain?.summary ?? null }, null, c);
    return { ...m, sub };
  });
  const u = await one<{ email: string; display_name: string }>("select email, display_name from users where id = $1", [r.user_id]);
  if (u) await sendEmail({ to: u.email, ...templates.manualConfirmed(u.display_name, r.sub.planLabel, formatMoney(r.amount_minor), r.reference, r.sub.current_period_end === "lifetime" ? "Lifetime" : new Date(r.sub.current_period_end).toUTCString()) });
  await syncDiscordRoleSafe(r.user_id);
  return { reference: r.reference, until: r.sub.current_period_end, verification: coin ? (manual ? "admin_attested" : "on_chain") : "admin_described" };
}

export async function rejectManualPayment(adminId: string, id: string, reason: string) {
  const r = await tx(async (c) => {
    const m = await one<{ reference: string; user_id: string; status: string }>("select reference, user_id, status from manual_payments where id = $1 for update", [id], c);
    if (!m) throw notFound("Submission not found.");
    if (m.status !== "pending_review") throw conflict(`This submission was already ${m.status === "approved" ? "approved" : "rejected"}.`);
    await q("update manual_payments set status = 'rejected', reviewed_by = $2, reviewed_at = now(), review_note = $3, updated_at = now() where id = $1", [id, adminId, reason], c);
    await audit(adminId, "admin.manual_payment_rejected", "manual_payment", m.reference, { user: m.user_id, reason }, null, c);
    return m;
  });
  const u = await one<{ email: string; display_name: string }>("select email, display_name from users where id = $1", [r.user_id]);
  if (u) await sendEmail({ to: u.email, ...templates.manualRejected(u.display_name, r.reference, reason) });
  return { reference: r.reference };
}

export async function getProof(id: string) {
  return one<{ filename: string; mime: string; data: Buffer; reference: string }>(
    "select f.filename, f.mime, f.data, m.reference from manual_payment_proofs f join manual_payments m on m.id = f.manual_payment_id where f.id = $1", [id]);
}
