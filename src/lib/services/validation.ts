import { z } from "zod";
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(200, "Use at most 200 characters.");
export const nameSchema = z.string().trim().min(2, "Enter your name.").max(60);
export const registerSchema = z.object({
  displayName: nameSchema, email: emailSchema, password: passwordSchema,
  confirmAge: z.literal(true, { error: "You must be 18 or older." }),
  acceptTerms: z.literal(true, { error: "Accept the terms to continue." }),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.").max(200) });
export const tokenSchema = z.string().min(20).max(200);
