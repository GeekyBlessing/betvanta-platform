import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { approveManualPayment, rejectManualPayment } from "@/lib/services/manual-payments";

// Approve (grants access) or reject a manual payment submission. Admins only.
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole("admin");
  const id = z.string().uuid().parse((await params).id);
  const b = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("approve"), note: z.string().trim().max(500).optional() }),
    z.object({ action: z.literal("reject"), note: z.string({ error: "Give the member a reason for the rejection." }).trim().min(5, "Give the member a reason (at least 5 characters).").max(500) }),
  ]));
  if (b.action === "approve") {
    const r = await approveManualPayment(admin.id, id, b.note || null);
    return ok({ message: `Approved ${r.reference}. Access is on${r.until === "lifetime" ? " for life" : ` until ${new Date(r.until).toUTCString()}`}.` });
  }
  const r = await rejectManualPayment(admin.id, id, b.note);
  return ok({ message: `Rejected ${r.reference}. The member has been told why.` });
});
