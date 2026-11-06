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
/** Where the player physically is, from a certified geolocation provider (not IP alone). */
export type GeoCheck = { stateCode: string | null; country: string | null; passed: boolean; provider: string; checkedAt: string };
export interface GeolocationProvider { check(userId: string, sessionToken: string): Promise<GeoCheck> }
/** Real-money actions are allowed only in US states where the operator holds a licence (sportsbook.licensed_jurisdictions). */
export interface JurisdictionPolicy { isPermitted(stateCode: string, operator: string): Promise<{ permitted: boolean; minAge: number | null; reason?: string }> }

export interface SportsbookOperator {
  id: string;
  enabled(): boolean;
  odds: OddsProvider;
  wallet: WalletService;
  placeBet(req: BetRequest): Promise<BetReceipt>;
  settlement: SettlementService;
  geolocation: GeolocationProvider;
  jurisdiction: JurisdictionPolicy;
}
