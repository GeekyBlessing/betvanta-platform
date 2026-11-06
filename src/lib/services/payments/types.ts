export type ProviderId = "stripe" | "paystack" | "nowpayments";
export type CryptoCurrency = "BTC" | "ETH" | "USDT";
export type PaymentRecord = { id: string; reference: string; amount_minor: string; currency: string; provider: ProviderId; provider_session_id: string | null; provider_payment_id: string | null; pay_currency: CryptoCurrency | null };
export type CheckoutInput = { reference: string; amountMinor: number; currency: "USD"; email: string; planLabel: string; payCurrency?: CryptoCurrency; userId: string; planCode: string };
export type CheckoutResult = { redirectUrl: string; providerSessionId?: string };
/** What the provider's own API says about a payment. Our code compares this against our record before granting access. */
export type ProviderVerification = { state: "success" | "pending" | "failed" | "partial"; amountMinor: number; currency: string; reference: string; providerPaymentId?: string; raw: unknown };

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  method: "card" | "crypto";
  enabled(): boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Returns null when the provider has nothing to confirm yet. */
  verify(p: PaymentRecord): Promise<ProviderVerification | null>;
}
