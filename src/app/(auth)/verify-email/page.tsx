import type { Metadata } from "next";
import { ApiForm } from "@/components/ApiForm";
import { Notice } from "@/components/ui";
export const metadata: Metadata = { title: "Verify email" };
// Verification needs a click (POST), so link scanners in mail clients cannot consume the token.
export default async function Verify(props: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await props.searchParams;
  if (!searchParams.token) return <Notice tone="danger">This verification link is incomplete.</Notice>;
  return (
    <div className="grid gap-6">
      <h1 className="display text-[28px] font-bold">Confirm your email</h1>
      <p className="text-muted">One click and your BETVANTA account is verified.</p>
      <ApiForm action="/api/auth/verify" extra={{ token: searchParams.token }} submitLabel="Verify my email" variant="accent" block />
    </div>
  );
}
