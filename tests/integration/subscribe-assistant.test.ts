import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePool, resetDb } from "../helpers";
import { one, q } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { approveManualPayment, rejectManualPayment, submissionSchema, submitManualPayment } from "@/lib/services/manual-payments";
import { paymentStatuses, subscribeAssistantProps } from "@/lib/services/manual-payments/assistant";

const env = (v: Record<string, string | undefined>) => { for (const [k, x] of Object.entries(v)) { if (x === undefined) delete process.env[k]; else process.env[k] = x; } resetEnvCache(); };
async function user(role = "member") {
  return (await one<{ id: string; email: string; display_name: string; role: "member" | "admin" }>(`insert into users(email, password_hash, display_name, role, age_confirmed_at, terms_accepted_at)
    values ($1,'x','Sam Lee',$2,now(),now()) returning id, email, display_name, role`, [`s${Math.random().toString(36).slice(2)}@x.com`, role]))!;
}
const sub = (planCode: string, method = "paypal") => submissionSchema.parse({ planCode, method, fullName: "Sam Lee", email: "sam@x.com", discordUsername: "sam_lee", reference: "REF-1" });

beforeEach(async () => { await resetDb(); env({ CRYPTO_PAYMENTS_ENABLED: "true" }); });
afterAll(async () => { env({ CRYPTO_PAYMENTS_ENABLED: undefined }); await closePool(); });

describe("subscription assistant", () => {
  it("opens on the chosen plan with every method, verified addresses and the member's name", async () => {
    const u = await user();
    const props = await subscribeAssistantProps({ ...u, status: "active", email_verified_at: null, notify_predictions: true, notify_billing: true } as never, "/pricing", { plan: "premium_6m", method: "usdt" });
    expect(props.initial).toEqual({ plan: "premium_6m", method: "usdt" });
    expect(props.user?.firstName).toBe("Sam");
    expect(props.plans.map((p) => p.code)).toEqual(["premium_1m", "premium_3m", "premium_6m", "premium_1y", "premium_lifetime"]);
    expect(props.methods.map((m) => m.id)).toEqual(["card", "btc", "eth", "usdt", "paypal", "venmo", "chime", "apple_pay", "other"]);
    expect(props.methods.find((m) => m.id === "usdt")).toMatchObject({ address: "0x7EE5E8D5149A55c6049f7b1042834cDAEB2f246d", network: null });
    expect(props.methods.find((m) => m.id === "btc")?.qrSvg).toContain("<svg");
    expect(props.methods.filter((m) => m.kind === "contact").every((m) => !m.address)).toBe(true);
  });

  it("ignores unknown plans and methods from the URL, and shows no address while crypto is off", async () => {
    env({ CRYPTO_PAYMENTS_ENABLED: "false" });
    const props = await subscribeAssistantProps(null, "/pricing", { plan: "free_forever", method: "btc" });
    expect(props.initial).toEqual({ plan: null, method: null });
    expect(props.user).toBeNull();
    expect(props.methods.filter((m) => m.kind === "crypto").every((m) => !m.enabled && !m.address && !m.qrSvg)).toBe(true);
  });

  it("reports Pending, then Confirmed after an admin verifies, and Rejected with the reason", async () => {
    const u = await user(), a = await user("admin");
    const r1 = await submitManualPayment(u, sub("premium_1m"), null);
    expect(await paymentStatuses(u.id)).toEqual([expect.objectContaining({ reference: r1.reference, planCode: "premium_1m", status: "pending", method: "PayPal" })]);
    const id1 = (await one<{ id: string }>("select id from manual_payments where reference = $1", [r1.reference]))!.id;
    await approveManualPayment(a.id, id1, null);
    expect((await paymentStatuses(u.id))[0]).toMatchObject({ status: "confirmed" });
    expect((await q("select 1 from subscriptions where user_id = $1 and status = 'active'", [u.id])).length).toBe(1);
    const r2 = await submitManualPayment(u, sub("premium_1y", "venmo"), null);
    const id2 = (await one<{ id: string }>("select id from manual_payments where reference = $1", [r2.reference]))!.id;
    await rejectManualPayment(a.id, id2, "No Venmo payment found.");
    const st = await paymentStatuses(u.id);
    expect(st.find((s) => s.planCode === "premium_1y")).toMatchObject({ status: "rejected", reason: "No Venmo payment found." });
    expect(st.find((s) => s.planCode === "premium_1m")).toMatchObject({ status: "confirmed" });
  });

  it("an upload alone never activates anything", async () => {
    const u = await user();
    await submitManualPayment(u, sub("premium_3m"), { name: "proof.png", data: Buffer.from("89504e470d0a1a0a0000000d49484452", "hex") });
    expect((await q("select 1 from subscriptions where user_id = $1", [u.id])).length).toBe(0);
    expect((await paymentStatuses(u.id))[0].status).toBe("pending");
  });
});
