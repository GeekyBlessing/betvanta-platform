"use client";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LogoMark } from "./ui";

export type AssistantMethod = {
  id: "btc" | "eth" | "usdt" | "paypal" | "venmo" | "chime" | "apple_pay" | "other";
  label: string; kind: "crypto" | "contact"; enabled: boolean;
  symbol?: string; walletName?: string; address?: string; qrSvg?: string; network?: string | null;
};
export type AssistantProps = {
  plan: { code: string; name: string; price: string; period: string; usdAmount: string };
  user: { firstName: string; displayName: string; email: string };
  methods: AssistantMethod[];
  discordUrl: string | null;
  supportEmail: string;
  pending: { reference: string; method: string; submittedAt: string } | null;
  initialMethod?: string | null;
};
type Result = { reference: string; method: string };

const Icon = {
  close: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  chat: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.6 3.7a.6.6 0 0 1-1-.5V16A1.5 1.5 0 0 1 4 14.5z" /></svg>,
  copy: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  warn: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l9 16H3z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>,
  discord: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.6 3.7a.6.6 0 0 1-1-.5V16A1.5 1.5 0 0 1 4 14.5z" /><circle cx="9" cy="9.6" r="1" fill="currentColor" /><circle cx="15" cy="9.6" r="1" fill="currentColor" /></svg>,
};

function Bot({ children }: { children: ReactNode }) {
  return (
    <div className="chat-in flex gap-2.5 items-end max-w-full">
      <span className="shrink-0 mb-0.5"><LogoMark size={26} /></span>
      <div className="min-w-0 rounded-2xl rounded-bl-md bg-sunken px-4 py-3 text-[14.5px] leading-6 grid gap-2">{children}</div>
    </div>
  );
}
function Me({ children }: { children: ReactNode }) {
  return <div className="chat-in flex justify-end"><div className="rounded-2xl rounded-br-md bg-brand text-on-brand px-4 py-2.5 text-[14.5px] leading-6 max-w-[85%]">{children}</div></div>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } finally { t.remove(); }
    }
    setDone(true); setTimeout(() => setDone(false), 2200);
  }
  return (
    <button type="button" onClick={copy} className="btn btn-primary btn-sm">
      {done ? Icon.check : Icon.copy}{done ? "Copied" : label}
      <span className="sr-only" aria-live="polite">{done ? " Address copied to clipboard" : ""}</span>
    </button>
  );
}

function DiscordButton({ url, children = "Contact Tom on Discord" }: { url: string | null; children?: ReactNode }) {
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-accent w-full sm:w-auto">{Icon.discord}{children}<span className="sr-only"> (opens Discord in a new tab)</span></a>
    : <a href="/community" className="btn btn-accent w-full sm:w-auto">{Icon.discord}{children}</a>;
}

export function PaymentAssistant(p: AssistantProps) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<AssistantMethod | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const choose = useCallback((id: string, trigger?: HTMLElement | null) => {
    const m = p.methods.find((x) => x.id === id) ?? null;
    if (trigger) lastTrigger.current = trigger;
    setMethod(m); setOpen(true);
  }, [p.methods]);

  useEffect(() => { if (p.initialMethod) choose(p.initialMethod); }, [p.initialMethod, choose]);
  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const small = window.matchMedia("(max-width: 767px)").matches;
    const prev = document.body.style.overflow;
    if (small) document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; lastTrigger.current?.focus?.(); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    // Scroll only the message list (scrollIntoView would also shift the panel and hide its header).
    const t = setTimeout(() => {
      const body = bodyRef.current, a = anchorRef.current;
      if (!body) return;
      body.scrollTo({ top: (method || result) && a ? Math.max(0, a.offsetTop - 8) : 0, behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [open, method, result]);

  const pending = result ? null : p.pending;

  return (
    <>
      {/* Method picker on the checkout page: choosing one opens the assistant */}
      <section className="card p-6 grid gap-4" aria-labelledby="pay-other-h">
        <div className="grid gap-1">
          <h2 id="pay-other-h" className="font-semibold text-[17px]">Pay with crypto, PayPal, Venmo and more</h2>
          <p className="text-sm text-muted">Choose a method and our payment assistant walks you through it. Access starts after we verify the payment.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {p.methods.map((m) => (
            <button key={m.id} type="button" onClick={(e) => choose(m.id, e.currentTarget)} data-method={m.id}
              className="method-chip rounded-lg border border-line-strong px-3 py-3 text-left grid gap-0.5 hover:border-[var(--accent)] focus-visible:border-[var(--accent)]">
              <span className="font-semibold text-sm">{m.symbol ?? m.label}</span>
              <span className="text-xs text-subtle">{m.kind === "crypto" ? (m.enabled ? m.walletName : "Coming soon") : m.id === "other" ? "Ask Tom" : "Via Tom on Discord"}</span>
            </button>))}
        </div>
      </section>

      {!open && (
        <button type="button" onClick={(e) => { lastTrigger.current = e.currentTarget; setOpen(true); }}
          className="chat-launcher fixed z-40 right-4 bottom-4 md:right-6 md:bottom-6 inline-flex items-center gap-2 rounded-full bg-brand text-on-brand pl-4 pr-5 py-3 font-semibold text-sm shadow-xl"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <span className="relative">{Icon.chat}<span aria-hidden className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-copper" /></span>Chat with us
        </button>)}

      {open && (
        <div role="dialog" aria-modal="false" aria-labelledby={titleId}
          className="chat-panel fixed z-50 inset-0 md:inset-auto md:right-6 md:bottom-6 md:w-[420px] md:h-[min(740px,calc(100vh-48px))] flex flex-col bg-surface md:rounded-xl md:border md:border-line shadow-2xl overflow-hidden">
          <header className="bg-brand text-on-brand px-4 py-3 flex items-center gap-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}>
            <LogoMark size={34} reversed />
            <div className="grid min-w-0 flex-1">
              <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-semibold leading-6 outline-none">BETVANTA Payments</h2>
              <span className="text-xs text-sand/75 truncate">{p.plan.name} · <span className="num">{p.plan.price}</span></span>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="h-10 w-10 grid place-items-center rounded-full hover:bg-white/10" aria-label="Close chat">{Icon.close}</button>
          </header>

          <div ref={bodyRef} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-5 grid content-start gap-4" aria-live="polite">
            <Bot><p>Hi {p.user.firstName}, welcome to BETVANTA. I&apos;ll help you pay for your plan.</p></Bot>
            <Bot>
              <p>You&apos;re subscribing to:</p>
              <div className="rounded-lg bg-surface border border-line px-3 py-2.5 grid gap-0.5">
                <span className="font-semibold">{p.plan.name}</span>
                <span className="text-sm text-muted"><span className="num font-semibold text-ink">{p.plan.price}</span> {p.plan.period}</span>
              </div>
            </Bot>

            {pending && (
              <Bot>
                <p>You already sent payment details for this plan. We&apos;re checking them now.</p>
                <StatusCard reference={pending.reference} method={pending.method} amount={p.plan.price} />
              </Bot>)}

            {!pending && !result && (
              <Bot>
                <p>How would you like to pay?</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Payment methods">
                  {p.methods.map((m) => (
                    <button key={m.id} type="button" onClick={() => setMethod(m)} aria-pressed={method?.id === m.id}
                      className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${method?.id === m.id ? "bg-brand text-on-brand border-transparent" : "bg-surface border-line-strong hover:border-[var(--accent)]"}`}>{m.symbol ?? m.label}</button>))}
                </div>
              </Bot>)}

            <div ref={anchorRef} className="scroll-mt-2" />
            {!pending && method && !result && <MethodFlow key={method.id} m={method} p={p} onDone={setResult} />}
            {result && (<>
              <Me>I&apos;ve sent my payment details.</Me>
              <Bot>
                <p>Thank you. Your payment is <strong>pending verification</strong>. We check every payment by hand before switching on access, and we&apos;ll email you at <strong>{p.user.email}</strong> as soon as it&apos;s approved.</p>
                <StatusCard reference={result.reference} method={result.method} amount={p.plan.price} />
                <p className="text-sm text-muted">Questions? Message Tom on Discord with your reference, or email <a className="text-link underline" href={`mailto:${p.supportEmail}`}>{p.supportEmail}</a>.</p>
                <a href="/dashboard/billing" className="text-sm font-semibold text-link hover:underline">Track it in Billing</a>
              </Bot>
            </>)}
          </div>
          <p className="border-t border-line px-4 py-2 text-[11px] text-subtle" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))" }}>
            BETVANTA staff will never ask for your password, card number or wallet recovery phrase.
          </p>
        </div>)}
    </>
  );
}

function StatusCard({ reference, method, amount }: { reference: string; method: string; amount: string }) {
  return (
    <div className="rounded-lg bg-surface border border-line p-3 grid gap-2">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-sm bg-warning-subtle text-warning px-2 py-0.5 text-xs font-semibold"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />Pending verification</span>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Reference</dt><dd className="num font-semibold break-all">{reference}</dd>
        <dt className="text-muted">Method</dt><dd>{method}</dd>
        <dt className="text-muted">Amount</dt><dd className="num">{amount}</dd>
      </dl>
      <div><CopyButton text={reference} label="Copy reference" /></div>
    </div>
  );
}

function MethodFlow({ m, p, onDone }: { m: AssistantMethod; p: AssistantProps; onDone: (r: Result) => void }) {
  const amountText = m.id === "usdt" ? `${p.plan.usdAmount} USDT` : `the equivalent of ${p.plan.price} in ${m.symbol}`;
  return (<>
    <Me>{m.label}</Me>
    {m.kind === "crypto" && !m.enabled && (
      <Bot>
        <p><strong>{m.label}</strong> payments aren&apos;t open yet. Tom can help you pay another way in the official BETVANTA Discord.</p>
        <DiscordButton url={p.discordUrl} />
      </Bot>)}
    {m.kind === "crypto" && m.enabled && (<>
      <Bot>
        <p>Send <strong>{amountText}</strong> to the BETVANTA {m.walletName} wallet below.</p>
        <div className="rounded-lg bg-surface border border-line p-3 grid gap-3 justify-items-center">
          <div className="qr bg-white rounded-md p-2 w-[180px] h-[180px]" role="img" aria-label={`QR code for the ${m.symbol} address`} dangerouslySetInnerHTML={{ __html: m.qrSvg ?? "" }} />
          <div className="w-full grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-[.08em] text-subtle">{m.symbol} address</span>
            <code className="num text-[13px] leading-5 break-all rounded-md bg-sunken px-2.5 py-2 select-all">{m.address}</code>
          </div>
          <div className="w-full grid gap-1 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted">Method</span><span className="font-semibold">{m.label}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Amount</span><span className="font-semibold text-right">{m.id === "usdt" ? `${p.plan.usdAmount} USDT (${p.plan.price})` : `${p.plan.price} in ${m.symbol}`}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Network</span><span className="font-semibold text-right">{m.network ?? "Not confirmed yet"}</span></div>
          </div>
          <div className="w-full"><CopyButton text={m.address!} label="Copy address" /></div>
        </div>
        {!m.network && (
          <div className="rounded-lg bg-warning-subtle text-ink p-3 grid gap-2 text-sm" role="note">
            <p className="flex gap-2 font-semibold text-warning">{Icon.warn}Confirm the network before you send</p>
            <p>This 0x address works on more than one blockchain, and the network for {m.symbol} payments has not been confirmed here yet. Message Tom on Discord to confirm which network to use. Sending on the wrong network can lose your funds for good.</p>
            <DiscordButton url={p.discordUrl}>Confirm the network with Tom</DiscordButton>
          </div>)}
      </Bot>
      <Bot>
        <p className="font-semibold">How to complete your payment</p>
        <ol className="list-decimal pl-5 grid gap-1 text-[14px]">
          <li>Copy the address or scan the QR code in your wallet app.</li>
          <li>Send {amountText}{m.network ? ` on ${m.network}` : " on the network Tom confirms"}. Check the address before you confirm.</li>
          {m.id !== "usdt" && <li>Price moves: send at least {p.plan.price} worth at the time you pay.</li>}
          <li>Copy the transaction hash (TXID) from your wallet once it is sent.</li>
          <li>Fill in the form below and add a screenshot of the payment.</li>
        </ol>
        <p className="text-sm text-muted">We verify the payment on the blockchain before switching on your access.</p>
      </Bot>
    </>)}
    {m.kind === "contact" && (
      <Bot>
        <p>We don&apos;t list {m.id === "other" ? "payment" : m.label} details on the website, so you never send money to an out-of-date or fake account.</p>
        <p><strong>Contact Tom in the official BETVANTA Discord</strong> for current {m.id === "other" ? "payment" : m.label} instructions. Mention the <strong>{p.plan.name}</strong> plan ({p.plan.price}).</p>
        <DiscordButton url={p.discordUrl} />
        <p className="text-sm text-muted">Only follow instructions from Tom inside the official BETVANTA Discord server.</p>
      </Bot>)}
    {(m.kind === "contact" || m.enabled) && (
      <Bot>
        <p className="font-semibold">{m.kind === "crypto" ? "Sent it? Send us your payment details." : "Paid using Tom's instructions? Send us your payment details."}</p>
        <ProofForm m={m} p={p} onDone={onDone} />
      </Bot>)}
  </>);
}

function ProofForm({ m, p, onDone }: { m: AssistantMethod; p: AssistantProps; onDone: (r: Result) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string[]>>({});
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const needNetwork = m.kind === "crypto" && !m.network;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const f = fd.get("proof");
    if (f && typeof f !== "string" && f.size > 4 * 1024 * 1024) { setFieldErr({ proof: ["Maximum 4 MB. Upload a smaller screenshot."] }); return; }
    if (f && typeof f !== "string" && f.size === 0) fd.delete("proof");
    fd.set("planCode", p.plan.code); fd.set("method", m.id);
    setBusy(true); setErr(null); setFieldErr({});
    try {
      const res = await fetch("/api/billing/manual", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({ ok: false, error: { message: "Unexpected response. Try again." } }));
      if (!j.ok) { setErr(j.error?.message ?? "Could not send your details."); setFieldErr(j.error?.details ?? {}); return; }
      onDone({ reference: j.data.reference, method: m.id === "other" ? String(fd.get("methodOther") || m.label) : m.label });
    } catch { setErr("Network error. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  const hint = (k: string) => fieldErr[k]?.length ? <span id={id(`${k}-e`)} className="text-[13px] text-danger">{fieldErr[k].join(" ")}</span> : null;
  const desc = (k: string, h?: string) => [h, fieldErr[k]?.length ? id(`${k}-e`) : null].filter(Boolean).join(" ") || undefined;
  const label = "text-[13px] font-semibold";
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg bg-surface border border-line p-3" noValidate>
      <div className="grid gap-1"><label htmlFor={id("name")} className={label}>Full name</label>
        <input id={id("name")} name="fullName" className="input" autoComplete="name" required defaultValue={p.user.displayName} aria-describedby={desc("fullName")} />{hint("fullName")}</div>
      <div className="grid gap-1"><label htmlFor={id("email")} className={label}>Email</label>
        <input id={id("email")} name="email" type="email" className="input" autoComplete="email" required defaultValue={p.user.email} aria-describedby={desc("email")} />{hint("email")}</div>
      <div className="grid gap-1"><label htmlFor={id("discord")} className={label}>Discord username</label>
        <input id={id("discord")} name="discordUsername" className="input" required placeholder="for example tom_bv" autoCapitalize="none" spellCheck={false} aria-describedby={desc("discordUsername")} />{hint("discordUsername")}</div>
      {m.id === "other" && <div className="grid gap-1"><label htmlFor={id("other")} className={label}>Payment method</label>
        <input id={id("other")} name="methodOther" className="input" required maxLength={40} placeholder="for example Cash App" aria-describedby={desc("methodOther")} />{hint("methodOther")}</div>}
      {needNetwork && <div className="grid gap-1"><label htmlFor={id("net")} className={label}>Network you sent on</label>
        <input id={id("net")} name="network" className="input" required maxLength={40} placeholder="as confirmed by Tom" aria-describedby={desc("network", id("net-h"))} />
        <span id={id("net-h")} className="text-[12px] text-subtle">For example Ethereum (ERC-20). Ask Tom if you are not sure.</span>{hint("network")}</div>}
      <div className="grid gap-1"><label htmlFor={id("ref")} className={label}>{m.kind === "crypto" ? "Transaction hash (TXID)" : "Payment ID or reference"}</label>
        <input id={id("ref")} name="reference" className="input num text-[13px]" maxLength={200} autoCapitalize="none" spellCheck={false} aria-describedby={desc("reference", id("ref-h"))} />
        <span id={id("ref-h")} className="text-[12px] text-subtle">Add this, a screenshot, or both.</span>{hint("reference")}</div>
      <div className="grid gap-1"><label htmlFor={id("proof")} className={label}>Payment proof <span className="font-normal text-subtle">(PNG, JPG, WebP or PDF, up to 4 MB)</span></label>
        <input id={id("proof")} name="proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="text-sm file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink" aria-describedby={desc("proof")} />{hint("proof")}</div>
      <div className="grid gap-1"><label htmlFor={id("note")} className={label}>Note <span className="font-normal text-subtle">(optional)</span></label>
        <textarea id={id("note")} name="note" className="input min-h-[64px]" maxLength={1000} /></div>
      {err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy && <span aria-hidden className="h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />}Send payment details</button>
      <p className="text-[12px] text-subtle">Access starts only after we verify your payment. Sending details does not activate a plan.</p>
    </form>
  );
}
