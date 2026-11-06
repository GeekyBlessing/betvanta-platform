import type { Metadata } from "next";
import Link from "next/link";
import { ApiForm, Field } from "@/components/ApiForm";
import { Notice } from "@/components/ui";
export const metadata: Metadata = { title: "Log in" };
const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : undefined);
export default async function Login(props: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="grid gap-6">
      <div><h1 className="display text-[28px] font-bold">Log in</h1><p className="text-muted mt-1">Welcome back to BETVANTA.</p></div>
      {searchParams.reset && <Notice tone="success">Password changed. Log in with your new password.</Notice>}
      <ApiForm action="/api/auth/login" submitLabel="Log in" variant="primary" block redirectTo={safeNext(searchParams.next)}>
        <Field label="Email address" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      </ApiForm>
      <div className="text-sm flex justify-between gap-3 flex-wrap"><Link href="/forgot-password" className="text-link font-semibold hover:underline">Forgot password?</Link><span className="text-muted">New here? <Link href="/register" className="text-link font-semibold hover:underline">Create an account</Link></span></div>
    </div>
  );
}
