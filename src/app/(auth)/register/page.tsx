import type { Metadata } from "next";
import Link from "next/link";
import { ApiForm, Check, Field } from "@/components/ApiForm";
export const metadata: Metadata = { title: "Create account" };
const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : undefined);
export default async function Register(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="grid gap-6">
      <div><h1 className="display text-[28px] font-bold">Create your account</h1><p className="text-muted mt-1">Free predictions now; upgrade any time.</p></div>
      <ApiForm action="/api/auth/register" submitLabel="Create account" variant="accent" block redirectTo={safeNext(searchParams.next)}>
        <Field label="Name" name="displayName" autoComplete="name" required />
        <Field label="Email address" name="email" type="email" autoComplete="email" hint="We send a verification link here." required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 12 characters. A short phrase works well." required />
        <Check name="confirmAge">I am 18 or older.</Check>
        <Check name="acceptTerms">I accept the <Link href="/legal/terms" className="text-link underline">terms</Link> and <Link href="/legal/privacy" className="text-link underline">privacy policy</Link>.</Check>
      </ApiForm>
      <p className="text-sm text-muted">Already have an account? <Link href="/login" className="text-link font-semibold hover:underline">Log in</Link></p>
    </div>
  );
}
