import { z } from "zod";
import { body, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { notFound } from "@/lib/errors";
export const POST = route(async (req: Request) => {
  const u = await requireUser();
  const b = await body(req, z.object({ competitionId: z.string().uuid(), favourite: z.boolean() }));
  if (!(await one("select 1 from competitions where id = $1", [b.competitionId]))) throw notFound("League not found.");
  if (b.favourite) await q("insert into user_favourite_competitions(user_id, competition_id) values ($1,$2) on conflict do nothing", [u.id, b.competitionId]);
  else await q("delete from user_favourite_competitions where user_id = $1 and competition_id = $2", [u.id, b.competitionId]);
  return ok({ message: b.favourite ? "Added to your leagues." : "Removed from your leagues." });
});
