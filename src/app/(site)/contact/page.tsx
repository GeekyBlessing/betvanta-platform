import type { Metadata } from "next";
import { ApiForm, Field } from "@/components/ApiForm";
import { DiscordGlyph } from "@/components/Discord";
import { InstagramGlyph, XGlyph } from "@/components/Community";
import { support } from "@/lib/support";
import { discordInviteUrl, instagramHandle, instagramUrl, xHandle, xUrl } from "@/lib/env";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact Us", description: "Contact BETVANTA, join our Discord and follow us on Instagram and X." };

export default function Contact() {
  const s = support();
  const discord = discordInviteUrl(), ig = instagramUrl(), xl = xUrl();
  return (
    <div className="wrap py-10 md:py-14 grid gap-10">
      <header className="text-center grid gap-2 justify-items-center">
        <h1 className="tb-h1 flex items-center gap-3">
          <svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-red hidden sm:block"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
          <span>Contact <span className="text-red">Us</span></span>
        </h1>
        <p className="text-muted">Get in touch with us for any inquiries or support</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section className="tb-card grid gap-4" aria-labelledby="form-h">
          <div className="grid gap-1"><h2 id="form-h" className="tb-h3">Send a Message</h2><p className="text-[14px] text-muted">Fill out the form below and we&apos;ll get back to you as soon as possible.</p></div>
          <ApiForm action="/api/contact" submitLabel="Send Message" variant="primary" refresh={false} resetOnSuccess>
            <Field label="Name" name="name" autoComplete="name" placeholder="Your name" required />
            <Field label="Email" name="email" type="email" autoComplete="email" placeholder="Your email" required />
            <div className="grid gap-1.5"><label htmlFor="f-message" className="label">Message</label><textarea id="f-message" name="message" rows={6} className="input" placeholder="Your message" required /></div>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          </ApiForm>
          <p className="text-[13px] text-subtle">Or email <a href={s.emailHref} className="text-white hover:underline">{s.email}</a> or call <a href={s.phoneHref} className="text-white hover:underline num">{s.phoneDisplay}</a>. Never send card numbers or passwords; BETVANTA staff will never ask for them.</p>
        </section>
        <div className="grid gap-6">
          {discord && <section className="tb-card grid gap-4" aria-labelledby="dc-h">
            <div className="grid gap-1"><h2 id="dc-h" className="tb-h3 flex items-center gap-2.5"><span className="text-red"><DiscordGlyph size={24} /></span>Join Our Discord</h2><p className="text-[14px] text-muted">Connect with our community and get instant access to premium picks</p></div>
            <div className="rounded-lg bg-black border border-line p-5 grid gap-3 justify-items-center text-center">
              <span className="font-bold text-[17px]">BETVANTA</span>
              <span className="text-[14px] text-muted">Join our Discord server for exclusive content and community discussions</span>
              <a href={discord} target="_blank" rel="noopener noreferrer" className="btn btn-accent">Join Discord Server<span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </section>}
          {ig && <section className="tb-card grid gap-4" aria-labelledby="ig-h">
            <div className="grid gap-1"><h2 id="ig-h" className="tb-h3 flex items-center gap-2.5"><span className="text-red"><InstagramGlyph size={24} /></span>Follow on Instagram</h2><p className="text-[14px] text-muted">Stay updated with our latest picks and announcements</p></div>
            <div className="rounded-lg bg-black border border-line p-5 grid gap-3 justify-items-center text-center">
              <span className="font-bold text-[17px]">{instagramHandle()}</span>
              <span className="text-[14px] text-muted">Follow us on Instagram for daily updates and exclusive content</span>
              <a href={ig} target="_blank" rel="noopener noreferrer" className="btn btn-accent">Follow on Instagram<span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </section>}
          {xl && <section className="tb-card grid gap-4" aria-labelledby="x-h">
            <div className="grid gap-1"><h2 id="x-h" className="tb-h3 flex items-center gap-2.5"><span className="text-red"><XGlyph size={24} /></span>Follow on X</h2><p className="text-[14px] text-muted">Analysis and match-day updates</p></div>
            <div className="rounded-lg bg-black border border-line p-5 grid gap-3 justify-items-center text-center">
              <span className="font-bold text-[17px]">{xHandle()}</span>
              <a href={xl} target="_blank" rel="noopener noreferrer" className="btn btn-accent">Follow on X<span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </section>}
        </div>
      </div>
    </div>
  );
}
