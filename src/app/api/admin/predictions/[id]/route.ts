import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { addAiAnalysis, deleteDraft, publishPrediction, updateDraft } from "@/lib/services/predictions";
const tier = z.enum(["free", "premium", "vip"]);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), accessTier: tier.optional() }),
  z.object({ action: z.literal("update"), selection: z.string().max(40).optional(), confidence: z.enum(["low", "medium", "high"]).optional(), accessTier: tier.optional(), analysis: z.string().max(6000).optional() }),
  z.object({ action: z.literal("delete") }),
  z.object({ action: z.literal("ai") }),
]);
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireRole("admin", "analyst");
  const id = z.string().uuid().parse((await params).id);
  const b = await body(req, schema);
  if (b.action === "publish") await publishPrediction(id, u.id, b.accessTier);
  if (b.action === "update") await updateDraft(id, u.id, b);
  if (b.action === "delete") await deleteDraft(id, u.id);
  if (b.action === "ai") await addAiAnalysis(id, u.id);
  return ok({ message: "Done." });
});
