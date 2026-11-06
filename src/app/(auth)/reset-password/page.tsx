import type { Metadata } from "next";
import { ApiForm, Field } from "@/components/ApiForm";
import { Notice } from "@/components/ui";
export const metadata: Metadata = { title: "Choose a new password" };
export default async function Reset(props: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await props.searchParams;
  if (!searchParams.token) return <Notice tone="danger">This reset link is incomplete. Request a new one.</Notice>;
  return (
    <div className="grid gap-6">
      <h1 className="display text-[28px] font-bold">Choose a new password</h1>
      <ApiForm action="/api/auth/reset" extra={{ token: searchParams.token }} submitLabel="Save new password" block>
        <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 12 characters." required />
      </ApiForm>
    </div>
  );
}
