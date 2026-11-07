import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, resetDb } from "../helpers";
import { one, q } from "@/lib/db";
import { resetSchemaCache, schemaStatus, tableExists } from "@/lib/schema";
import { LATEST_MIGRATION } from "@/lib/migrations";
import { manualPaymentsReady, submissionSchema, submitManualPayment } from "@/lib/services/manual-payments";

beforeAll(resetDb);
afterAll(closePool);

describe("code deployed ahead of the database", () => {
  it("reports the schema as current when every migration is applied", async () => {
    expect(await schemaStatus()).toMatchObject({ latest: LATEST_MIGRATION, expected: LATEST_MIGRATION, current: true });
  });

  it("switches the payment assistant off, visibly, while its table is missing (the live 500 on checkout and billing)", async () => {
    const u = (await one<{ id: string; email: string; display_name: string }>(`insert into users(email, password_hash, display_name, age_confirmed_at, terms_accepted_at)
      values ('guard@x.com','x','G',now(),now()) returning id, email, display_name`))!;
    await q("alter table manual_payments rename to manual_payments_moved");
    resetSchemaCache();
    try {
      expect(await tableExists("public.manual_payments")).toBe(false);
      expect(await manualPaymentsReady()).toBe(false);
      const input = submissionSchema.parse({ planCode: "premium_1m", method: "paypal", fullName: "Guard Test", email: "g@x.com", discordUsername: "guard", reference: "PP-1" });
      await expect(submitManualPayment(u, input, null)).rejects.toThrow(/not available yet/);
    } finally {
      await q("alter table manual_payments_moved rename to manual_payments");
      resetSchemaCache();
    }
    expect(await manualPaymentsReady()).toBe(true);
  });

  it("reports the schema as behind when the newest migration is missing", async () => {
    await q("delete from schema_migrations where version = $1", [LATEST_MIGRATION]);
    try { expect(await schemaStatus()).toMatchObject({ current: false, expected: LATEST_MIGRATION }); }
    finally { await q("insert into schema_migrations(version) values ($1)", [LATEST_MIGRATION]); }
  });
});
