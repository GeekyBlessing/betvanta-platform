import { body, ok, route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { statUpdateSchema, updateHomepageStat } from "@/lib/services/homepage-stats";
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ key: string }> }) => {
  const admin = await requireRole("admin");
  const input = await body(req, statUpdateSchema);
  await updateHomepageStat(admin.id, (await params).key, input);
  return ok({ message: "Saved. The homepage shows the new figure now." });
});
