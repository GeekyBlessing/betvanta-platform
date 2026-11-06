import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { nowpayments } from "@/lib/services/payments/nowpayments";
import { fmtKickoff } from "@/components/ui";
describe("business configuration", () => {
  afterEach(() => { process.env.CRYPTO_PAYMENTS_ENABLED = "true"; resetEnvCache(); });
  it("keeps crypto off unless explicitly approved, even with keys present", () => {
    delete process.env.CRYPTO_PAYMENTS_ENABLED; resetEnvCache();
    expect(nowpayments.enabled()).toBe(false);
    process.env.CRYPTO_PAYMENTS_ENABLED = "true"; resetEnvCache();
    expect(nowpayments.enabled()).toBe(true);
  });
  it("shows kickoff times in US Eastern by default", () => {
    delete process.env.APP_TIMEZONE;
    expect(fmtKickoff("2026-07-04T23:00:00Z")).toMatch(/Jul 4, 7:00\s?PM EDT/);
  });
});
