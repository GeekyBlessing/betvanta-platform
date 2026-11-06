import { ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { MAX_PROOF_BYTES, submissionSchema, submitManualPayment } from "@/lib/services/manual-payments";
export const dynamic = "force-dynamic";

// Multipart form from the payment assistant: the member's details plus an optional proof file.
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_PROOF_BYTES + 64 * 1024) throw badRequest("Proof files can be up to 4 MB. Upload a smaller screenshot.", { proof: ["Maximum 4 MB."] });
  let form: FormData;
  try { form = await req.formData(); } catch { throw badRequest("Send the form as multipart/form-data."); }
  const field = (k: string) => { const v = form.get(k); return typeof v === "string" ? v : undefined; };
  const input = submissionSchema.parse({
    planCode: field("planCode"), method: field("method"), methodOther: field("methodOther"), network: field("network"),
    fullName: field("fullName"), email: field("email"), discordUsername: field("discordUsername"), reference: field("reference"), note: field("note"),
  });
  const f = form.get("proof");
  const proof = f && typeof f !== "string" && f.size > 0 ? { name: f.name || "proof", data: Buffer.from(await f.arrayBuffer()) } : null;
  const r = await submitManualPayment(user, input, proof);
  return ok({ ...r, message: "Payment details received. Status: pending verification." }, 201);
});
