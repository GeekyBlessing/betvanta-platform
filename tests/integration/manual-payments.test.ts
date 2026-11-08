import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type http from "node:http";
import { chain, startChainStub } from "../chainStub";
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

const BTC = "bc1qu2pq8h060lpu3g5yg8zzc39lr85mal3vpek4dv";
let stub: http.Server;
beforeAll(async () => { stub = await startChainStub(4596); });
beforeEach(async () => {
  await resetDb();
  withEnv({ CRYPTO_PAYMENTS_ENABLED: "true", CRYPTO_ETH_NETWORK: undefined, CRYPTO_USDT_NETWORK: undefined, DISCORD_SUPPORT_URL: undefined, DISCORD_INVITE_URL: undefined, ETHERSCAN_API_KEY: undefined });
  chain.btc.clear(); chain.evm.clear();
  // the default test submission's transaction: 0.0011 BTC to BETVANTA, 6 confirmations
  chain.btc.set("a".repeat(64), { vout: [{ scriptpubkey_address: BTC, value: 110000 }], status: { confirmed: true, block_height: chain.tip - 5 } });
});
afterAll(async () => { withEnv({ CRYPTO_PAYMENTS_ENABLED: undefined }); await new Promise<void>((r) => stub.close(() => r())); await closePool(); });

const AMT = { note: "0.0011 BTC received, worth about $70 when it arrived", amountConfirmed: true };

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

  it("does not assume a network for ETH or USDT: they cannot be used until it is configured, and the customer cannot set it", async () => {
    const u = await user();
    expect(walletNetwork("eth")).toBeNull();
    expect(walletNetwork("usdt")).toBeNull();
    await expect(submitManualPayment(u, input({ method: "usdt", network: "Ethereum (ERC-20)", reference: "0x" + "b".repeat(64) }), null)).rejects.toThrow(/network has not been confirmed/);
    withEnv({ CRYPTO_USDT_NETWORK: "Ethereum (ERC-20)" });
    const r = await submitManualPayment(u, input({ method: "usdt", network: "BNB Chain", reference: "0x" + "b".repeat(64) }), null);
    expect((await one<{ network: string; pay_to_address: string }>("select network, pay_to_address from manual_payments where reference = $1", [r.reference]))).toEqual({ network: "Ethereum (ERC-20)", pay_to_address: "0x7EE5E8D5149A55c6049f7b1042834cDAEB2f246d" });
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
    const res = await approveManualPayment(a.id, id, AMT);
    expect(res.reference).toBe(r.reference);
    expect(await tierFor({ id: u.id } as never)).toBe("vip");
    const row = await one<{ status: string; subscription_id: string; reviewed_by: string }>("select * from manual_payments where id = $1", [id]);
    expect(row).toMatchObject({ status: "approved", reviewed_by: a.id });
    expect(row!.subscription_id).toBeTruthy();
    await expect(approveManualPayment(a.id, id, null)).rejects.toThrow(/already approved/);
    await expect(rejectManualPayment(a.id, id, "changed my mind")).rejects.toThrow(/already approved/);
    await expect(q("update manual_payments set status = 'pending_review' where id = $1", [id])).rejects.toThrow(/already approved/);
    const sent = await q<{ template: string }>("select template from email_outbox where to_email = $1 order by created_at", [u.email]);
    expect(sent.map((s) => s.template)).toEqual(["manual_received", "manual_confirmed"]);
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
    await approveManualPayment(a.id, (await listManualPayments("pending_review"))[0].id, AMT);
    expect((await q("select 1 from payments where user_id = $1", [u.id])).length).toBe(0);
    expect((await q("select 1 from sportsbook.wallets where user_id = $1", [u.id])).length).toBe(0);
  });
});

describe("manual payments: on-chain verification before approval", () => {
  const pending = async () => (await listManualPayments("pending_review"))[0].id;
  it("approves a BTC payment only when the blockchain shows it reached the BETVANTA address with enough confirmations", async () => {
    const u = await user(), a = await user("admin");
    chain.btc.set("c".repeat(64), { vout: [{ scriptpubkey_address: "bc1qsomeoneelse000000000000000000000000000", value: 500000 }], status: { confirmed: true, block_height: chain.tip - 10 } });
    await submitManualPayment(u, input({ reference: "c".repeat(64) }), { name: "shot.png", data: png });
    await expect(approveManualPayment(a.id, await pending(), "looks fine")).rejects.toThrow(/does not pay the BETVANTA Bitcoin address/);
    await expect(approveManualPayment(a.id, await pending(), { note: "I checked it myself on the explorer, trust me", verifiedManually: true })).rejects.toThrow(/Blockchain check failed/);
    expect((await q("select 1 from subscriptions where user_id = $1", [u.id])).length).toBe(0);
  });

  it("waits for confirmations and refuses unknown transactions", async () => {
    const u = await user(), a = await user("admin");
    chain.btc.set("d".repeat(64), { vout: [{ scriptpubkey_address: BTC, value: 110000 }], status: { confirmed: false } });
    await submitManualPayment(u, input({ reference: "d".repeat(64) }), null);
    await expect(approveManualPayment(a.id, await pending(), null)).rejects.toThrow(/0 of 2 confirmations/);
    chain.btc.set("d".repeat(64), { vout: [{ scriptpubkey_address: BTC, value: 110000 }], status: { confirmed: true, block_height: chain.tip } });
    await expect(approveManualPayment(a.id, await pending(), null)).rejects.toThrow(/1 of 2 confirmations/);
    chain.tip += 1;
    // Confirmed on chain, but BTC's dollar value is not checked automatically: the admin must confirm and record it.
    await expect(approveManualPayment(a.id, await pending(), null)).rejects.toThrow(/covers the plan price/);
    await expect(approveManualPayment(a.id, await pending(), { note: "short", amountConfirmed: true })).rejects.toThrow(/covers the plan price/);
    await expect(approveManualPayment(a.id, await pending(), AMT)).resolves.toMatchObject({ verification: "on_chain" });
    const u2 = await user();
    await submitManualPayment(u2, input({ reference: "e".repeat(64) }), null);
    await expect(approveManualPayment(a.id, await pending(), null)).rejects.toThrow(/does not exist/);
  });

  it("one transaction can activate only one plan", async () => {
    const u = await user(), v = await user(), a = await user("admin");
    await submitManualPayment(u, input(), null);
    await approveManualPayment(a.id, await pending(), AMT);
    await submitManualPayment(v, input(), null);
    await expect(approveManualPayment(a.id, await pending(), AMT)).rejects.toThrow(/already activated/);
  });

  it("a screenshot without a hash needs the admin to verify the transaction and say how", async () => {
    const u = await user(), a = await user("admin");
    await submitManualPayment(u, input({ reference: undefined }), { name: "shot.png", data: png });
    const id = await pending();
    await expect(approveManualPayment(a.id, id, "ok")).rejects.toThrow(/could not confirm this payment/);
    await expect(approveManualPayment(a.id, id, { note: "short", verifiedManually: true })).rejects.toThrow(/could not confirm/);
    await expect(approveManualPayment(a.id, id, { note: "Found 0.0011 BTC to bc1qu2pq in wallet history, tx 4f2a, 3 confs", verifiedManually: true })).resolves.toMatchObject({ verification: "admin_attested" });
    expect((await one<{ verified_manually: boolean; chain_status: string }>("select verified_manually, chain_status from manual_payments where id = $1", [id]))).toEqual({ verified_manually: true, chain_status: "unsupported" });
  });

  it("verifies USDT on Ethereum through Etherscan, including the amount", async () => {
    withEnv({ CRYPTO_USDT_NETWORK: "Ethereum (ERC-20)", ETHERSCAN_API_KEY: "es_unit" });
    const to = "0x" + "0".repeat(24) + "7ee5e8d5149a55c6049f7b1042834cdaeb2f246d";
    const log = (amount: number) => ({ address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x" + "0".repeat(64), to], data: "0x" + (amount * 1e6).toString(16) });
    const h1 = "0x" + "1".repeat(64), h2 = "0x" + "2".repeat(64);
    chain.evm.set(h1, { tx: { to: "0xdac17f958d2ee523a2206206994597c13d831ec7", value: "0x0", blockNumber: "0x" + (chain.evmHead - 20).toString(16), hash: h1 }, receipt: { status: "0x1", blockNumber: "0x" + (chain.evmHead - 20).toString(16), logs: [log(20)] } });
    chain.evm.set(h2, { tx: { to: "0xdac17f958d2ee523a2206206994597c13d831ec7", value: "0x0", blockNumber: "0x" + (chain.evmHead - 20).toString(16), hash: h2 }, receipt: { status: "0x1", blockNumber: "0x" + (chain.evmHead - 20).toString(16), logs: [log(50)] } });
    const u = await user(), v = await user(), a = await user("admin");
    await submitManualPayment(u, input({ method: "usdt", reference: h1 }), null);
    await expect(approveManualPayment(a.id, await pending(), null)).rejects.toThrow(/Only 20 USDT was received; the plan costs 50 USDT/);
    await rejectManualPayment(a.id, await pending(), "Underpaid");
    await submitManualPayment(v, input({ method: "usdt", reference: h2 }), null);
    await expect(approveManualPayment(a.id, await pending(), null)).resolves.toMatchObject({ verification: "on_chain" });
  });

  it("other networks are verified by hand, never automatically approved", async () => {
    withEnv({ CRYPTO_ETH_NETWORK: "BNB Smart Chain (BEP-20)", ETHERSCAN_API_KEY: "es_unit" });
    const u = await user(), a = await user("admin");
    await submitManualPayment(u, input({ method: "eth", reference: "0x" + "3".repeat(64) }), null);
    await expect(approveManualPayment(a.id, await pending(), null)).rejects.toThrow(/Ethereum mainnet only/);
  });

  it("non-crypto approvals need a description of the payment found", async () => {
    const u = await user(), a = await user("admin");
    await submitManualPayment(u, input({ method: "paypal", reference: "PP-1" }), { name: "shot.png", data: png });
    await expect(approveManualPayment(a.id, await pending(), null)).rejects.toThrow(/Describe the payment you found/);
    await expect(approveManualPayment(a.id, await pending(), "PayPal 9XK21 $50 received 7 Nov")).resolves.toMatchObject({ verification: "admin_described" });
  });
});

describe("Contact BETVANTA on Discord link", () => {
  it("accepts only Discord channel, user or invite links, else falls back to the invite", () => {
    withEnv({ DISCORD_SUPPORT_URL: "https://discord.com/channels/123/456" });
    expect(discordSupportUrl()).toBe("https://discord.com/channels/123/456");
    withEnv({ DISCORD_SUPPORT_URL: "https://evil.example/discord.com/users/1", DISCORD_INVITE_URL: "https://discord.gg/betvanta" });
    expect(discordSupportUrl()).toBe("https://discord.gg/betvanta");
    withEnv({ DISCORD_SUPPORT_URL: undefined, DISCORD_INVITE_URL: undefined });
    expect(discordSupportUrl()).toBe("https://discord.com/invite/STDJ29shZS");
  });
});
