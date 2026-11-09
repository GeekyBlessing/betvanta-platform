import { z } from "zod";
import { one, q } from "../db";
import { audit } from "../audit";
import { badRequest, notFound } from "../errors";

export const CONSENT_TEXT = "I agree that BETVANTA may publish this review with the name and location I entered, on its website and marketing. I can withdraw it at any time from my dashboard.";
export const testimonialSchema = z.object({
  displayName: z.string().trim().min(2, "Enter the name to show.").max(40),
  location: z.string().trim().max(40).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(20, "Write at least 20 characters.").max(600, "Keep it under 600 characters."),
  consent: z.literal(true, { error: "Tick the box to allow us to publish your review." }),
});

export async function submitTestimonial(userId: string, input: z.infer<typeof testimonialSchema>) {
  const open = await one("select 1 from testimonials where user_id = $1 and status = 'pending'", [userId]);
  if (open) throw badRequest("You already have a review waiting for approval.");
  const paid = await one("select 1 from payments where user_id = $1 and status = 'success'", [userId]);
  const row = await one<{ id: string }>(
    `insert into testimonials(user_id, display_name, location, rating, body, verified_subscriber, consent_at, consent_text) values ($1,$2,$3,$4,$5,$6, now(), $7) returning id`,
    [userId, input.displayName, input.location || null, input.rating, input.body, Boolean(paid), CONSENT_TEXT]);
  await audit(userId, "testimonial.submit", "testimonial", row!.id, { rating: input.rating });
  return row!.id;
}
export async function withdrawTestimonial(userId: string, id: string) {
  const r = await one("update testimonials set status = 'withdrawn' where id = $1 and user_id = $2 and status in ('pending','approved') returning id", [id, userId]);
  if (!r) throw notFound("Review not found.");
  await audit(userId, "testimonial.withdraw", "testimonial", id);
}
export async function moderateTestimonial(adminId: string, id: string, action: "approve" | "reject") {
  const r = await one(`update testimonials set status = $2, reviewed_by = $3, reviewed_at = now() where id = $1 and status in ('pending','approved','rejected') returning id`,
    [id, action === "approve" ? "approved" : "rejected", adminId]);
  if (!r) throw notFound("Review not found or withdrawn.");
  await audit(adminId, `testimonial.${action}`, "testimonial", id);
}
export type PublicTestimonial = { id: string; display_name: string; location: string | null; rating: number; body: string; verified_subscriber: boolean; created_at: string };
/** Only reviews with recorded consent, approved by an admin, from accounts that still exist. */
export const approvedTestimonials = (limit = 6, shuffle = false) => q<PublicTestimonial>(
  `select t.id, t.display_name, t.location, t.rating, t.body, t.verified_subscriber, t.created_at from testimonials t join users u on u.id = t.user_id
   where t.status = 'approved' and t.consent_at is not null and u.status = 'active' order by ${shuffle ? "random()" : "t.reviewed_at desc"} limit $1`, [limit]);
