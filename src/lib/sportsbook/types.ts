/**
 * Integration contract for a FUTURE licensed sportsbook operator (Phase 2+).
 * Phase 1 ships only the disabled implementation. Money for wagers must never touch public.payments,
 * which is reserved for subscription payments; it lives in the separate "sportsbook" schema.
 */
export type OddsQuote = { fixtureId: string; bookmaker: string; market: string; selection: string; price: number; capturedAt: string; licenceRef: string };
export type BetRequest = { userId: string; fixtureId: string; market: string; selection: string; price: number; stakeMinor: number };
export type BetReceipt = { betId: string; operatorBetRef: string; status: "accepted" | "rejected"; acceptedPrice?: number };
export type WalletBalance = { currency: "USD"; availableMinor: number; heldMinor: number };

export interface OddsProvider { quotes(fixtureId: string): Promise<OddsQuote[]> }
export interface WalletService {
  balance(userId: string): Promise<WalletBalance>;
  deposit(userId: string, amountMinor: number, idempotencyKey: string): Promise<{ redirectUrl: string }>;
  withdraw(userId: string, amountMinor: number, idempotencyKey: string): Promise<{ status: "pending" }>;
}
export interface SettlementService { settle(betId: string): Promise<"won" | "lost" | "void"> }
export interface SportsbookOperator {
  id: string;
  enabled(): boolean;
  odds: OddsProvider;
  wallet: WalletService;
  placeBet(req: BetRequest): Promise<BetReceipt>;
  settlement: SettlementService;
}
