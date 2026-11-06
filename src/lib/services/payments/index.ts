import { paystack } from "./paystack";
import { stripeProvider } from "./stripe";
import { nowpayments } from "./nowpayments";
import type { PaymentProvider, ProviderId } from "./types";
export const PROVIDERS: Record<ProviderId, PaymentProvider> = { stripe: stripeProvider, paystack, nowpayments };
export const enabledProviders = () => Object.values(PROVIDERS).filter((p) => p.enabled());
export * from "./types";
