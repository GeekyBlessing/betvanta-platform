import { cryptoApproved, env } from "../../env";

export const CRYPTO_METHODS = ["btc", "eth", "usdt"] as const;
export const OTHER_METHODS = ["paypal", "venmo", "chime", "apple_pay", "other"] as const;
export const MANUAL_METHODS = [...CRYPTO_METHODS, ...OTHER_METHODS] as const;
export type CryptoMethod = (typeof CRYPTO_METHODS)[number];
export type ManualMethod = (typeof MANUAL_METHODS)[number];

/**
 * Client-confirmed receiving wallets. Kept in code on purpose: changing where customers send money needs a reviewed
 * commit and deploy, not a dashboard edit. Checksums are verified by tests/unit/wallets.test.ts.
 */
export const WALLETS: Record<CryptoMethod, { symbol: string; name: string; address: string }> = {
  btc: { symbol: "BTC", name: "Bitcoin", address: "bc1qu2pq8h060lpu3g5yg8zzc39lr85mal3vpek4dv" },
  eth: { symbol: "ETH", name: "Ethereum", address: "0x283bed6B2dB8b70FB245a9734fc6479C60C59E9C" },
  usdt: { symbol: "USDT", name: "Tether", address: "0x7EE5E8D5149A55c6049f7b1042834cDAEB2f246d" },
};

export const METHOD_LABELS: Record<ManualMethod, string> = {
  btc: "Bitcoin (BTC)", eth: "Ethereum (ETH)", usdt: "Tether (USDT)", paypal: "PayPal", venmo: "Venmo", chime: "Chime", apple_pay: "Apple Pay", other: "Other method",
};

export const isCrypto = (m: string): m is CryptoMethod => (CRYPTO_METHODS as readonly string[]).includes(m);

/**
 * The network a wallet receives on. A bc1 address only exists on Bitcoin, so BTC is fixed.
 * The two 0x addresses work on several EVM chains, so ETH and USDT stay unconfirmed until configured.
 */
export function walletNetwork(m: CryptoMethod): string | null {
  if (m === "btc") return "Bitcoin";
  return (m === "eth" ? env().CRYPTO_ETH_NETWORK : env().CRYPTO_USDT_NETWORK) ?? null;
}

/** Crypto collection stays off until CRYPTO_PAYMENTS_ENABLED=true (legal and provider approval, see docs/COMPLIANCE.md). */
export const manualCryptoEnabled = () => cryptoApproved();

/** Block-explorer link for a transaction hash, only when the network is known and the hash is well formed. */
export function explorerUrl(m: string, network: string | null, hash: string | null): string | null {
  if (!hash) return null;
  const h = hash.trim();
  if (m === "btc" && /^[0-9a-fA-F]{64}$/.test(h)) return `https://mempool.space/tx/${h.toLowerCase()}`;
  if ((m === "eth" || m === "usdt") && /^0x[0-9a-fA-F]{64}$/.test(h)) {
    const n = (network ?? "").toLowerCase();
    const base = /^(ethereum|erc-?20|ethereum mainnet)/.test(n) ? "https://etherscan.io" : /^(bnb|bsc|bep-?20)/.test(n) ? "https://bscscan.com"
      : /^polygon/.test(n) ? "https://polygonscan.com" : /^arbitrum/.test(n) ? "https://arbiscan.io" : /^base/.test(n) ? "https://basescan.org" : /^optimism/.test(n) ? "https://optimistic.etherscan.io" : null;
    return base ? `${base}/tx/${h.toLowerCase()}` : null;
  }
  return null;
}
