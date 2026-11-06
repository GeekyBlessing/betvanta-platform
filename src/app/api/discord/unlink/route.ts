import { ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { unlinkDiscord } from "@/lib/services/discord";
export const POST = route(async () => { const u = await requireUser(); await unlinkDiscord(u.id); return ok({ message: "Discord account unlinked." }); });
