import QRCode from "qrcode";
import { q } from "../../db";
import { discordSupportUrl } from "../../env";
import { support } from "../../support";
import type { SessionUser } from "../../session";
import { formatMoney, periodLabel, type Plan } from "../billing";
import { enabledProviders } from "../payments";
import type { AssistantMethod, PaymentStatus, SubscribeAssistantProps } from "@/components/SubscribeAssistant";
import { CRYPTO_METHODS, manualCryptoEnabled, METHOD_LABELS, OTHER_METHODS, walletNetwork, WALLETS } from "./methods";
import { manualPaymentsReady, methodLabel, type ManualPayment } from "./index";

const STATUS: Record<ManualPayment["status"], PaymentStatus["status"]> = { pending_review: "pending", approved: "confirmed", rejected: "rejected" };
const SHORT: Record<string, string> = { btc: "Bitcoin", eth: "Ethereum", usdt: "USDT", paypal: "PayPal", venmo: "Venmo", chime: "Chime", apple_pay: "Apple Pay", other: "Other" };

/** The member's latest submission per plan, in the words the assistant shows: Pending, Confirmed or Rejected. */
export async function paymentStatuses(userId: string): Promise<PaymentStatus[]> {
  if (!(await manualPaymentsReady())) return [];
  const rows = await q<Pick<ManualPayment, "reference" | "method" | "method_other" | "status" | "review_note" | "created_at"> & { plan_code: string }>(
    `select distinct on (m.plan_id) m.reference, m.method, m.method_other, m.status, m.review_note, m.created_at, p.code plan_code
     from manual_payments m join plans p on p.id = m.plan_id where m.user_id = $1 order by m.plan_id, m.created_at desc`, [userId]);
  return rows.map((r) => ({ reference: r.reference, planCode: r.plan_code, method: methodLabel(r), status: STATUS[r.status],
    reason: r.status === "rejected" ? r.review_note : null, at: new Date(r.created_at).toISOString() }));
}

/** Everything the subscription assistant needs, built on the server so addresses come only from the verified wallet list. */
export async function subscribeAssistantProps(user: SessionUser | null, returnPath: string, initial?: { plan?: string; method?: string }): Promise<SubscribeAssistantProps> {
  const [plans, manualReady, statuses] = await Promise.all([
    q<Plan>("select * from plans where active order by level"),
    manualPaymentsReady(),
    user ? paymentStatuses(user.id) : Promise.resolve([]),
  ]);
  const card = enabledProviders().filter((p) => p.method === "card");
  const cryptoOn = manualCryptoEnabled();
  const methods: AssistantMethod[] = [
    { id: "card", label: "Card", short: "Card", kind: "card", enabled: card.length > 0, providers: card.map((c) => ({ id: c.id, label: c.label.replace(/^Card \((.+)\)$/, "$1") })) },
    ...(await Promise.all(CRYPTO_METHODS.map(async (id): Promise<AssistantMethod> => ({
      id, label: METHOD_LABELS[id], short: SHORT[id], kind: "crypto", enabled: cryptoOn, symbol: WALLETS[id].symbol, walletName: WALLETS[id].name,
      ...(cryptoOn ? { address: WALLETS[id].address, network: walletNetwork(id),
        qrSvg: await QRCode.toString(WALLETS[id].address, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#172322", light: "#FFFFFF" } }) } : {}),
    })))),
    ...OTHER_METHODS.map((id): AssistantMethod => ({ id, label: METHOD_LABELS[id], short: SHORT[id], kind: "contact", enabled: true })),
  ];
  const valid = (c?: string) => (c && plans.some((p) => p.code === c) ? c : null);
  const validMethod = (m?: string) => (m && methods.some((x) => x.id === m) ? m : null);
  return {
    plans: plans.map((p) => { const usd = Number(p.amount_minor) / 100; return { code: p.code, name: p.name, price: formatMoney(p.amount_minor), period: periodLabel(p), usdAmount: Number.isInteger(usd) ? String(usd) : usd.toFixed(2), best: p.best_value }; }),
    user: user ? { firstName: user.display_name.split(/\s+/)[0], displayName: user.display_name, email: user.email } : null,
    methods, discordUrl: discordSupportUrl(), supportEmail: support().email, statuses, manualReady, returnPath,
    initial: { plan: valid(initial?.plan), method: valid(initial?.plan) ? validMethod(initial?.method) : null },
  };
}
