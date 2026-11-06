import type { Metadata } from "next";
import { pageUser } from "@/lib/auth";
import { ApiForm, Check, Field } from "@/components/ApiForm";
import { PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Settings" };
export default async function Settings() {
  const u = await pageUser("/dashboard/settings");
  return (<>
    <PageHeader eyebrow="Account" title="Settings" />
    <div className="grid gap-6 max-w-[640px]">
      <section className="card p-6 grid gap-4"><h2 className="font-semibold text-[17px]">Profile and notifications</h2>
        <p className="text-sm text-muted">Email: <strong>{u.email}</strong> {u.email_verified_at ? "(verified)" : "(not verified)"}</p>
        <ApiForm action="/api/account" method="PATCH" submitLabel="Save settings">
          <Field label="Name" name="displayName" defaultValue={u.display_name} required />
          <Check name="notifyPredictions" defaultChecked={u.notify_predictions}>Email me about new predictions</Check>
          <Check name="notifyBilling" defaultChecked={u.notify_billing}>Email me billing reminders</Check>
        </ApiForm></section>
      <section className="card p-6 grid gap-4"><h2 className="font-semibold text-[17px]">Change password</h2>
        <ApiForm action="/api/account/password" submitLabel="Change password" resetOnSuccess refresh={false}>
          <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
          <Field label="New password" name="newPassword" type="password" autoComplete="new-password" hint="At least 12 characters." required />
        </ApiForm></section>
      <section className="card p-6 grid gap-4 border-danger"><h2 className="font-semibold text-[17px]">Delete account</h2>
        <p className="text-sm text-muted">Removes your personal details and ends any access immediately. Payment records are kept without your personal details. This cannot be undone.</p>
        <ApiForm action="/api/account" method="DELETE" submitLabel="Delete my account" variant="danger">
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          <Field label='Type DELETE to confirm' name="confirm" required />
        </ApiForm></section>
    </div>
  </>);
}
