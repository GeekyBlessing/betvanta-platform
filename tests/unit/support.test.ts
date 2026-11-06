import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { support } from "@/lib/support";
import { templates } from "@/lib/email";
describe("customer support contact", () => {
  afterEach(() => { delete process.env.SUPPORT_EMAIL; delete process.env.SUPPORT_PHONE; resetEnvCache(); });
  it("defaults to the client-provided email and US phone number", () => {
    resetEnvCache();
    expect(support()).toEqual({ email: "betvanta098@gmail.com", emailHref: "mailto:betvanta098@gmail.com", phoneDisplay: "(314) 343-6703", phoneHref: "tel:+13143436703" });
  });
  it("accepts a 10-digit number without country code", () => {
    process.env.SUPPORT_PHONE = "3143436703"; resetEnvCache();
    expect(support().phoneHref).toBe("tel:+13143436703");
  });
  it("adds the support contact to every email footer", () => {
    resetEnvCache();
    for (const t of [templates.verify("A", "x"), templates.receipt("A", "Monthly Premium", "$50", "BV-1", "Lifetime"), templates.cancelled("A", "x")]) {
      expect(t.text).toContain("betvanta098@gmail.com");
      expect(t.text).toContain("(314) 343-6703");
    }
  });
});
