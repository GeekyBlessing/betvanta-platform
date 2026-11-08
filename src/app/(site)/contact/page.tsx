import type { Metadata } from "next";
import { ApiForm, Field } from "@/components/ApiForm";
import { JoinDiscordButton } from "@/components/Discord";
import { PageHeader } from "@/components/ui";
import { support } from "@/lib/support";
import { instagramHandle, instagramUrl } from "@/lib/env";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact support", description: "Contact BETVANTA customer support by email, phone or message." };
export default function Contact() {
  const s = support();
  return (
    <div className="wrap py-10 grid gap-8">
      <PageHeader eyebrow="Support" title="Contact BETVANTA">Questions about your account, billing or our predictions. Choose whichever is easiest for you.</PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <a href={s.emailHref} className="card p-5 grid gap-1 hover:border-[var(--accent)]">
          <span className="text-[13px] font-medium text-muted">Email</span>
          <span className="font-semibold text-[16px] break-all">{s.email}</span>
          <span className="text-xs text-subtle">We reply by email</span>
        </a>
        <a href={s.phoneHref} className="card p-5 grid gap-1 hover:border-[var(--accent)]">
          <span className="text-[13px] font-medium text-muted">Phone</span>
          <span className="font-semibold text-[16px] num">{s.phoneDisplay}</span>
          <span className="text-xs text-subtle">US number</span>
        </a>
        <div className="card p-5 grid gap-2 content-start">
          <span className="text-[13px] font-medium text-muted">Community</span>
          <span className="font-semibold text-[16px]">BETVANTA Discord</span>
          <JoinDiscordButton className="btn btn-accent btn-sm w-fit" label="Join Our Discord" />
        </div>
        {instagramUrl() && <a href={instagramUrl()!} target="_blank" rel="noopener noreferrer" className="card p-5 grid gap-1 content-start hover:border-[var(--accent)]">
          <span className="text-[13px] font-medium text-muted">Instagram</span>
          <span className="font-semibold text-[16px]">{instagramHandle()}</span>
          <span className="text-xs font-semibold text-link">Follow Us on Instagram<span className="sr-only"> (opens in a new tab)</span></span>
        </a>}
      </div>
      <section className="card p-6 grid gap-4 max-w-[640px]" aria-labelledby="form-h">
        <h2 id="form-h" className="font-semibold text-[17px]">Send a message</h2>
        <ApiForm action="/api/contact" submitLabel="Send message" variant="primary" refresh={false} resetOnSuccess>
          <Field label="Name" name="name" autoComplete="name" required />
          <Field label="Email address" name="email" type="email" autoComplete="email" required />
          <div className="grid gap-1.5"><label htmlFor="f-message" className="label">Message</label><textarea id="f-message" name="message" rows={6} className="input" required /></div>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        </ApiForm>
      </section>
      <p className="text-xs text-subtle">Never send card numbers or passwords by email, phone or this form. BETVANTA staff will never ask for them.</p>
    </div>
  );
}
