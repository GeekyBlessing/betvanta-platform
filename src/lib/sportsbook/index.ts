import type { SportsbookOperator } from "./types";
export * from "./types";

const off = async (): Promise<never> => { throw new Error("Sportsbook is not available in this phase. Real-money betting, deposits and withdrawals are disabled."); };

/** Phase 1: every sportsbook capability is hard-disabled. A licensed operator adapter replaces this in a later phase. */
export const disabledOperator: SportsbookOperator = {
  id: "disabled",
  enabled: () => false,
  odds: { quotes: async () => [] },
  wallet: { balance: off, deposit: off, withdraw: off },
  placeBet: off,
  settlement: { settle: off },
};
export const sportsbook: SportsbookOperator = disabledOperator;
