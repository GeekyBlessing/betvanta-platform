import type { Metadata } from "next";
import { pageUser } from "@/lib/auth";
import { ApiForm, Check, Field } from "@/components/ApiForm";
import { Notice, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/ActionButton";
import { one } from "@/lib/db";
import { discordOAuthEnabled, env } from "@/lib/env";
export const metadata: Metadata = { title: "Settings" };
export default async function Settings(props: { searchParams: Promise<{ discord?: string }> }) {
  const u = await pageUser("/dashboard/settings");
  const { discord } = await props.searchParams;
  const d = await one<{ discord_username: string | null; discord_linked_at: string | null }>("select discord_username, discord_linked_at from users where id = $1", [u.id]);
  const msg: Record<string, [string, "success" | "warning" | "danger"]> = { linked: ["Discord linked. Your role matches your plan.", "success"], failed: ["We could not link Discord. Try again.", "danger"], cancelled: ["Discord linking was cancelled.", "warning"], unavailable: ["Discord linking is not switched on yet.", "warning"] };
  return (<>
    <PageHeader eyebrow="Account" title="Settings" />
    <div className="grid gap-6 max-w-[640px]">
      {discord && msg[discord] && <Notice tone={msg[discord][1]}>{msg[discord][0]}</Notice>}
      <section className="card p-6 grid gap-3"><h2 className="font-semibold text-[17px]">Discord community</h2>
        {d?.discord_linked_at ? (<>
          <p className="text-sm">Linked as <strong>{d.discord_username}</strong>. Your server role updates automatically when your plan changes.</p>
          <div><ActionButton action="/api/discord/unlink" label="Unlink Discord" variant="secondary" confirmText="Confirm unlink" /></div>
        </>) : discordOAuthEnabled() ? (<>
          <p className="text-sm text-muted">Link Discord to join the BETVANTA server and get the Premium or VIP role that matches your plan.</p>
          <div><a href="/api/discord/connect" className="btn btn-primary">Link Discord</a></div>
        </>) : env().DISCORD_INVITE_URL ? <p className="text-sm">Join the community: <a className="text-link font-semibold underline" href={env().DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">BETVANTA on Discord</a>. Automatic roles are coming soon.</p>
          : <p className="text-sm text-muted">The Discord community is not open yet.</p>}
      </section>
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
