import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePool, resetDb } from "../helpers";
import { one, q } from "@/lib/db";
import { discordSupportUrl, resetEnvCache } from "@/lib/env";
import { tierFor } from "@/lib/services/entitlements";
import { approveManualPayment, listManualPayments, rejectManualPayment, submissionSchema, submitManualPayment, walletNetwork } from "@/lib/services/manual-payments";

const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
async function user(role = "member") {
  const u = await one<{ id: string; email: string; display_name: string }>(`insert into users(email, password_hash, display_name, role, age_confirmed_at, terms_accepted_at)
    values ($1,'x','Pat Payer',$2,now(),now()) returning id, email, display_name`, [`p${Math.random().toString(36).slice(2)}@x.com`, role]);
  return u!;
}
const input = (o: Record<string, unknown> = {}) => submissionSchema.parse({ planCode: "premium_1m", method: "btc", fullName: "Pat Payer", email: "pat@example.com", discordUsername: "@pat_payer", reference: "a".repeat(64), ...o });
const withEnv = (vars: Record<string, string | undefined>) => { for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } resetEnvCache(); };

beforeEach(async () => { await resetDb(); withEnv({ CRYPTO_PAYMENTS_ENABLED: "true", CRYPTO_ETH_NETWORK: undefined, CRYPTO_USDT_NETWORK: undefined, DISCORD_SUPPORT_URL: undefined, DISCORD_INVITE_URL: undefined }); });
afterAll(async () => { withEnv({ CRYPTO_PAYMENTS_ENABLED: undefined }); await closePool(); });

describe("manual payments: submission", () => {
  it("records a pending submission with the wallet address shown, and grants nothing", async () => {
    const u = await user();
    const r = await submitManualPayment(u, input(), { name: "shot.png", data: png });
    const row = await one<{ status: string; pay_to_address: string; network: string; discord_username: string; amount_minor: string }>("select * from manual_payments where reference = $1", [r.reference]);
    expect(row).toMatchObject({ status: "pending_review", pay_to_address: "bc1qu2pq8h060lpu3g5yg8zzc39lr85mal3vpek4dv", network: "Bitcoin", discord_username: "pat_payer", amount_minor: "5000" });
    expect(await tierFor({ id: u.id } as never)).toBe("free");
    expect((await q("select 1 from subscriptions where user_id = $1", [u.id])).length).toBe(0);
  });

  it("keeps crypto closed until CRYPTO_PAYMENTS_ENABLED is true, but other methods stay open", async () => {
    withEnv({ CRYPTO_PAYMENTS_ENABLED: "false" });
    const u = await user();
    await expect(submitManualPayment(u, input(), null)).rejects.toThrow(/Crypto payments are not open yet/);
    await expect(submitManualPayment(u, input({ method: "venmo", reference: "VEN-1" }), null)).resolves.toMatchObject({ status: "pending_review" });
  });

  it("does not assume a network for ETH or USDT until it is configured", async () => {
    const u = await user();
    expect(walletNetwork("eth")).toBeNull();
    expect(walletNetwork("usdt")).toBeNull();
    await expect(submitManualPayment(u, input({ method: "usdt", reference: "0x" + "b".repeat(64) }), null)).rejects.toThrow(/network/);
    const r = await submitManualPayment(u, input({ method: "usdt", network: "Ethereum (ERC-20)", reference: "0x" + "b".repeat(64) }), null);
    expect((await one<{ network: string }>("select network from manual_payments where reference = $1", [r.reference]))!.network).toBe("Ethereum (ERC-20)");
    withEnv({ CRYPTO_ETH_NETWORK: "Ethereum mainnet" });
    expect(walletNetwork("eth")).toBe("Ethereum mainnet");
    const e = await submitManualPayment(await user(), input({ method: "eth", network: "something else", reference: "0x" + "c".repeat(64) }), null);
    expect((await one<{ network: string }>("select network from manual_payments where reference = $1", [e.reference]))!.network).toBe("Ethereum mainnet");
  });

  it("needs a reference or proof, a real image or PDF, and a named method for Other", async () => {
    const u = await user();
    await expect(submitManualPayment(u, input({ reference: undefined }), null)).rejects.toThrow(/transaction hash/);
    await expect(submitManualPayment(u, input(), { name: "x.png", data: Buffer.from("<script>") })).rejects.toThrow(/PNG, JPG, WebP or PDF/);
    await expect(submitManualPayment(u, input(), { name: "big.png", data: Buffer.concat([png, Buffer.alloc(4 * 1024 * 1024)]) })).rejects.toThrow(/4 MB/);
    await expect(submitManualPayment(u, input({ method: "other", reference: "X" }), null)).rejects.toThrow(/which payment method/);
    expect(() => input({ discordUsername: "bad name!" })).toThrow();
    expect(() => input({ email: "nope" })).toThrow();
  });

  it("allows one open submission per plan", async () => {
    const u = await user();
    const first = await submitManualPayment(u, input(), null);
    await expect(submitManualPayment(u, input({ method: "paypal", reference: "PP" }), null)).rejects.toThrow(new RegExp(first.reference));
    await expect(submitManualPayment(u, input({ planCode: "premium_3m", method: "paypal", reference: "PP" }), null)).resolves.toBeTruthy();
  });
});

describe("manual payments: review", () => {
  it("approval grants the plan's access in the same step and is final", async () => {
    const u = await user(), a = await user("admin");
    const r = await submitManualPayment(u, input({ planCode: "premium_6m" }), null);
    const id = (await listManualPayments("pending_review"))[0].id;
    const res = await approveManualPayment(a.id, id, "received");
    expect(res.reference).toBe(r.reference);
    expect(await tierFor({ id: u.id } as never)).toBe("vip");
    const row = await one<{ status: string; subscription_id: string; reviewed_by: string }>("select * from manual_payments where id = $1", [id]);
    expect(row).toMatchObject({ status: "approved", reviewed_by: a.id });
    expect(row!.subscription_id).toBeTruthy();
    await expect(approveManualPayment(a.id, id, null)).rejects.toThrow(/already approved/);
    await expect(rejectManualPayment(a.id, id, "changed my mind")).rejects.toThrow(/already approved/);
    await expect(q("update manual_payments set status = 'pending_review' where id = $1", [id])).rejects.toThrow(/already approved/);
    const sent = await q<{ template: string }>("select template from email_outbox where to_email = $1 order by created_at", [u.email]);
    expect(sent.map((s) => s.template)).toEqual(["manual_received", "receipt"]);
  });

  it("rejection records the reason, emails the member and allows a new submission", async () => {
    const u = await user(), a = await user("admin");
    await submitManualPayment(u, input(), null);
    const id = (await listManualPayments("pending_review"))[0].id;
    await rejectManualPayment(a.id, id, "No payment found for this hash.");
    expect((await one<{ review_note: string }>("select review_note from manual_payments where id = $1", [id]))!.review_note).toBe("No payment found for this hash.");
    expect((await q("select 1 from subscriptions where user_id = $1", [u.id])).length).toBe(0);
    expect((await one<{ template: string }>("select template from email_outbox where to_email = $1 order by created_at desc limit 1", [u.email]))!.template).toBe("manual_rejected");
    await expect(submitManualPayment(u, input(), null)).resolves.toBeTruthy();
  });

  it("the database refuses approvals without access and rejections without a reason", async () => {
    const u = await user();
    const r = await submitManualPayment(u, input(), null);
    await expect(q("update manual_payments set status = 'approved', reviewed_by = $2, reviewed_at = now() where reference = $1", [r.reference, u.id])).rejects.toThrow(/approved_has_access/);
    await expect(q("update manual_payments set status = 'rejected', reviewed_by = $2, reviewed_at = now() where reference = $1", [r.reference, u.id])).rejects.toThrow(/rejected_has_reason/);
  });

  it("the app role cannot delete submissions or change proofs, and Supabase API roles get nothing", async () => {
    const g = await q<{ t: string; p: string }>(`select table_name t, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants
      where grantee = 'betvanta_app' and table_name in ('manual_payments','manual_payment_proofs') group by 1 order by 1`);
    expect(g).toEqual([{ t: "manual_payment_proofs", p: "INSERT,SELECT" }, { t: "manual_payments", p: "INSERT,SELECT,UPDATE" }]);
    expect(await q("select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_name like 'manual_payment%'")).toEqual([]);
  });

  it("kept separate from provider payments and sportsbook wallets", async () => {
    const u = await user(), a = await user("admin");
    await submitManualPayment(u, input(), null);
    await approveManualPayment(a.id, (await listManualPayments("pending_review"))[0].id, null);
    expect((await q("select 1 from payments where user_id = $1", [u.id])).length).toBe(0);
    expect((await q("select 1 from sportsbook.wallets where user_id = $1", [u.id])).length).toBe(0);
  });
});

describe("Contact Tom on Discord link", () => {
  it("accepts only Discord channel, user or invite links, else falls back to the invite", () => {
    withEnv({ DISCORD_SUPPORT_URL: "https://discord.com/channels/123/456" });
    expect(discordSupportUrl()).toBe("https://discord.com/channels/123/456");
    withEnv({ DISCORD_SUPPORT_URL: "https://evil.example/discord.com/users/1", DISCORD_INVITE_URL: "https://discord.gg/betvanta" });
    expect(discordSupportUrl()).toBe("https://discord.gg/betvanta");
    withEnv({ DISCORD_SUPPORT_URL: undefined, DISCORD_INVITE_URL: undefined });
    expect(discordSupportUrl()).toBe("https://discord.com/invite/STDJ29shZS");
  });
});
