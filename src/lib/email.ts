import { q } from "./db";
import { env, emailEnabled } from "./env";

type Msg = { to: string; template: string; subject: string; text: string };

const footer = "\n\n--\nBETVANTA. Smarter Insights. Better Decisions.\nPredictions are analysis, not guarantees. 18+ only. Play responsibly.";

export const templates = {
  verify: (name: string, link: string): Omit<Msg, "to"> => ({ template: "verify", subject: "Verify your BETVANTA account",
    text: `Hi ${name},\n\nConfirm your email address to finish setting up your BETVANTA account:\n${link}\n\nThis link expires in 24 hours. If you did not create an account, ignore this email.` + footer }),
  reset: (name: string, link: string): Omit<Msg, "to"> => ({ template: "reset", subject: "Reset your BETVANTA password",
    text: `Hi ${name},\n\nUse this link to choose a new password:\n${link}\n\nIt expires in 1 hour and works once. If you did not ask for this, you can ignore this email; your password has not changed.` + footer }),
  passwordChanged: (name: string): Omit<Msg, "to"> => ({ template: "password_changed", subject: "Your BETVANTA password was changed",
    text: `Hi ${name},\n\nYour password was just changed and other sessions were signed out. If this was not you, reset your password now and contact support.` + footer }),
  receipt: (name: string, plan: string, amount: string, ref: string, until: string): Omit<Msg, "to"> => ({ template: "receipt", subject: `BETVANTA receipt: ${plan}`,
    text: `Hi ${name},\n\nPayment received and verified.\n\nPlan: ${plan}\nAmount: ${amount}\nReference: ${ref}\nAccess until: ${until}\n\nThank you for subscribing.` + footer }),
  cancelled: (name: string, until: string): Omit<Msg, "to"> => ({ template: "cancelled", subject: "Your BETVANTA subscription is cancelled",
    text: `Hi ${name},\n\nYour subscription will not renew. You keep access until ${until}.` + footer }),
  expiring: (name: string, plan: string, until: string): Omit<Msg, "to"> => ({ template: "expiring", subject: "Your BETVANTA plan ends soon",
    text: `Hi ${name},\n\nYour ${plan} access ends on ${until}. Renew from Billing in your dashboard to keep access.` + footer }),
};

/** Sends through Resend when configured; otherwise records the message in the outbox (visible to admins) without sending. */
export async function sendEmail(m: Msg) {
  if (!emailEnabled()) {
    await q("insert into email_outbox(to_email, template, subject, body_text, status) values ($1,$2,$3,$4,'logged')", [m.to, m.template, m.subject, m.text]);
    return { status: "logged" as const };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env().EMAIL_FROM, to: [m.to], subject: m.subject, text: m.text }),
    });
    const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    const status = res.ok ? "sent" : "failed";
    await q("insert into email_outbox(to_email, template, subject, body_text, status, provider_id, error) values ($1,$2,$3,$4,$5,$6,$7)",
      [m.to, m.template, m.subject, m.text, status, j.id ?? null, res.ok ? null : (j.message ?? `HTTP ${res.status}`)]);
    return { status };
  } catch (e) {
    await q("insert into email_outbox(to_email, template, subject, body_text, status, error) values ($1,$2,$3,$4,'failed',$5)", [m.to, m.template, m.subject, m.text, String(e)]);
    return { status: "failed" as const };
  }
}
