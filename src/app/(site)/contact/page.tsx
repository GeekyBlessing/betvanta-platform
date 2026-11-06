import type { Metadata } from "next";
import { ApiForm, Field } from "@/components/ApiForm";
import { PageHeader } from "@/components/ui";
export const metadata: Metadata = { title: "Contact", description: "Contact the BETVANTA team." };
export default function Contact() {
  return (
    <div className="wrap py-10 max-w-[640px]">
      <PageHeader eyebrow="Contact" title="Talk to us">Questions about your account, billing or our predictions. We reply by email.</PageHeader>
      <div className="card p-6">
        <ApiForm action="/api/contact" submitLabel="Send message" variant="primary" refresh={false} resetOnSuccess>
          <Field label="Name" name="name" autoComplete="name" required />
          <Field label="Email address" name="email" type="email" autoComplete="email" required />
          <div className="grid gap-1.5"><label htmlFor="f-message" className="label">Message</label><textarea id="f-message" name="message" rows={6} className="input" required /></div>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        </ApiForm>
      </div>
    </div>
  );
}
