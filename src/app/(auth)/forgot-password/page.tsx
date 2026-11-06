import type { Metadata } from "next";
import Link from "next/link";
import { ApiForm, Field } from "@/components/ApiForm";
export const metadata: Metadata = { title: "Reset password" };
export default function Forgot() {
  return (
    <div className="grid gap-6">
      <div><h1 className="display text-[28px] font-bold">Reset your password</h1><p className="text-muted mt-1">Enter your email and we will send a reset link.</p></div>
      <ApiForm action="/api/auth/forgot" submitLabel="Send reset link" block refresh={false}><Field label="Email address" name="email" type="email" autoComplete="email" required /></ApiForm>
      <Link href="/login" className="text-sm text-link font-semibold hover:underline">Back to log in</Link>
    </div>
  );
}
