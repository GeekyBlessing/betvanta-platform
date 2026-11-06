import { z } from "zod";
import { route } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { getProof } from "@/lib/services/manual-payments";
export const dynamic = "force-dynamic";

// Serves an uploaded proof to admins only. The type was checked from the file bytes at upload; these headers stop
// the browser from treating it as anything else or running scripts from it.
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireRole("admin");
  const id = z.string().uuid().parse((await params).id);
  const p = await getProof(id);
  if (!p) throw notFound("Proof not found.");
  const inline = p.mime.startsWith("image/");
  return new Response(new Uint8Array(p.data), {
    headers: {
      "Content-Type": p.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${p.reference}-${p.filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
});
