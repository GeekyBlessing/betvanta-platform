import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers";
import { one, q } from "@/lib/db";
import { sportsbook } from "@/lib/sportsbook";
describe("sportsbook integration points stay disabled", () => {
  beforeEach(resetDb);
  it("the database refuses wallet, ledger and bet writes in this phase", async () => {
    const u = (await one(`insert into users(email, password_hash, display_name, age_confirmed_at, terms_accepted_at) values ('s@x.com','x','S',now(),now()) returning id`))!;
    await expect(q("insert into sportsbook.wallets(user_id) values ($1)", [u.id])).rejects.toThrow(/disabled/);
    await expect(q("update sportsbook.settings set real_money_enabled = true")).rejects.toThrow(/check constraint/);
  });
  it("the application layer refuses bet placement and wallet operations", async () => {
    expect(sportsbook.enabled()).toBe(false);
    await expect(sportsbook.placeBet({ userId: "u", fixtureId: "f", market: "1X2", selection: "Home win", price: 2, stakeMinor: 100 })).rejects.toThrow(/not available/);
    await expect(sportsbook.wallet.balance("u")).rejects.toThrow(/not available/);
  });
});
