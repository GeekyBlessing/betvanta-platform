import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { approveManualPayment, checkManualPayment, rejectManualPayment } from "@/lib/services/manual-payments";

// Check on the blockchain, approve (grants access only after verification) or reject a manual payment. Admins only.
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole("admin");
  const id = z.string().uuid().parse((await params).id);
  const b = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("check") }),
    z.object({ action: z.literal("approve"), note: z.string().trim().max(500).optional(), verifiedManually: z.boolean().optional(), amountConfirmed: z.boolean().optional() }),
    z.object({ action: z.literal("reject"), note: z.string({ error: "Give the member a reason for the rejection." }).trim().min(5, "Give the member a reason (at least 5 characters).").max(500) }),
  ]));
  if (b.action === "check") {
    const r = await checkManualPayment(admin.id, id);
    return ok({ message: `Blockchain check: ${r.status}. ${r.summary}`, chain: r });
  }
  if (b.action === "approve") {
    const r = await approveManualPayment(admin.id, id, { note: b.note || null, verifiedManually: b.verifiedManually, amountConfirmed: b.amountConfirmed });
    return ok({ message: `Approved ${r.reference} (${r.verification === "on_chain" ? "verified on the blockchain" : "verified by you"}). Access is on${r.until === "lifetime" ? " for life" : ` until ${new Date(r.until).toUTCString()}`}. A confirmation email has been sent.` });
  }
  const r = await rejectManualPayment(admin.id, id, b.note);
  return ok({ message: `Rejected ${r.reference}. The member has been told why.` });
});
