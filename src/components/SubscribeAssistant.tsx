"use client";
import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { LogoMark } from "./ui";

/**
 * The BETVANTA subscription journey. Any element with data-subscribe="<plan code>" (every "Subscribe Now" button)
 * opens this chat straight away: welcome, plan and price, payment method, instructions and verified address,
 * proof upload, then the payment status. Access is granted only by an admin after the payment is verified.
 */

export type AssistantMethod = {
  id: "card" | "btc" | "eth" | "usdt" | "paypal" | "venmo" | "chime" | "apple_pay" | "other";
  label: string; short: string; kind: "card" | "crypto" | "contact"; enabled: boolean;
  symbol?: string; walletName?: string; address?: string; qrSvg?: string; network?: string | null;
  providers?: { id: string; label: string }[];
  unavailable?: "crypto_off" | "network_unconfirmed" | null;
};
export type AssistantPlan = { code: string; name: string; price: string; period: string; usdAmount: string; best?: boolean };
export type PaymentStatus = { reference: string; planCode: string; method: string; status: "pending" | "confirmed" | "rejected"; reason: string | null; at: string };
export type SubscribeAssistantProps = {
  plans: AssistantPlan[];
  user: { firstName: string; displayName: string; email: string } | null;
  methods: AssistantMethod[];
  discordUrl: string | null;
  supportEmail: string;
  statuses: PaymentStatus[];   // the member's latest submission per plan
  manualReady: boolean;        // false until the manual payments migration is applied
  initial?: { plan?: string | null; method?: string | null };
  returnPath: string;          // where login and registration send the member back to
};

const Icon = {
  close: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  copy: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  warn: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l9 16H3z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>,
  upload: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>,
  refresh: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4" /></svg>,
  discord: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.6 3.7a.6.6 0 0 1-1-.5V16A1.5 1.5 0 0 1 4 14.5z" /><circle cx="9" cy="9.6" r="1" fill="currentColor" /><circle cx="15" cy="9.6" r="1" fill="currentColor" /></svg>,
};

function Bot({ children }: { children: ReactNode }) {
  return (
    <div className="chat-in flex gap-2.5 items-end max-w-full">
      <span className="shrink-0 mb-0.5"><LogoMark size={26} /></span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md bg-sunken px-4 py-3 text-[14.5px] leading-6 grid gap-2">{children}</div>
    </div>
  );
}
function Me({ children }: { children: ReactNode }) {
  return <div className="chat-in flex justify-end"><div className="rounded-2xl rounded-br-md bg-brand text-on-brand px-4 py-2.5 text-[14.5px] leading-6 max-w-[85%]">{children}</div></div>;
}
function Chips<T extends { key: string; label: string; sub?: string; active?: boolean }>({ items, onPick, label }: { items: T[]; onPick: (t: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {items.map((t) => (
        <button key={t.key} type="button" onClick={() => onPick(t)} aria-pressed={Boolean(t.active)} data-chip={t.key}
          className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${t.active ? "bg-brand text-on-brand border-transparent" : "bg-surface border-line-strong hover:border-[var(--accent)]"}`}>
          {t.label}{t.sub ? <span className={`font-normal ${t.active ? "text-sand/75" : "text-subtle"}`}>&nbsp;· {t.sub}</span> : null}
        </button>))}
    </div>
  );
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
      <span className="sr-only" aria-live="polite">{done ? ` ${label.replace(/^Copy /, "")} copied to clipboard` : ""}</span>
    </button>
  );
}
function DiscordButton({ url, children = "Contact BETVANTA on Discord" }: { url: string | null; children?: ReactNode }) {
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-accent w-full sm:w-auto">{Icon.discord}{children}<span className="sr-only"> (opens Discord in a new tab)</span></a>
    : <a href="/community" className="btn btn-accent w-full sm:w-auto">{Icon.discord}{children}</a>;
}

const STATUS_UI = {
  pending: { label: "Pending", tone: "bg-warning-subtle text-warning", text: "We are checking your payment. Access starts as soon as it is confirmed, and we will email you." },
  confirmed: { label: "Confirmed", tone: "bg-success-subtle text-success", text: "Payment confirmed and your plan is active. A confirmation email is on its way." },
  rejected: { label: "Rejected", tone: "bg-danger-subtle text-danger", text: "We could not verify this payment, so access was not switched on." },
} as const;

function StatusCard({ s, amount, onRefresh, busy }: { s: PaymentStatus; amount: string; onRefresh?: () => void; busy?: boolean }) {
  const ui = STATUS_UI[s.status];
  return (
    <div className="rounded-lg bg-surface border border-line p-3 grid gap-2" data-status={s.status}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold ${ui.tone}`}><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />Status: {ui.label}</span>
        {onRefresh && s.status === "pending" && <button type="button" onClick={onRefresh} disabled={busy} className="btn btn-ghost btn-sm">{Icon.refresh}{busy ? "Checking" : "Refresh"}</button>}
      </div>
      <p className="text-sm">{ui.text}</p>
      {s.status === "rejected" && s.reason && <p className="text-sm"><strong>Reason:</strong> {s.reason}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Reference</dt><dd className="num font-semibold break-all">{s.reference}</dd>
        <dt className="text-muted">Method</dt><dd>{s.method}</dd>
        <dt className="text-muted">Amount</dt><dd className="num">{amount}</dd>
      </dl>
      {s.status === "pending" && <div><CopyButton text={s.reference} label="Copy reference" /></div>}
    </div>
  );
}

export function SubscribeAssistant(p: SubscribeAssistantProps) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [method, setMethod] = useState<AssistantMethod | null>(null);
  const [statuses, setStatuses] = useState<PaymentStatus[]>(p.statuses);
  const [justSent, setJustSent] = useState<string | null>(null);
  const [startOver, setStartOver] = useState(false);
  const [checking, setChecking] = useState(false);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const start = useCallback((planCode: string | null, methodId?: string | null, trigger?: HTMLElement | null) => {
    if (trigger) lastTrigger.current = trigger;
    setPlan(p.plans.find((x) => x.code === planCode) ?? null);
    setMethod(methodId ? p.methods.find((m) => m.id === methodId) ?? null : null);
    setJustSent(null); setStartOver(false); setOpen(true);
  }, [p.plans, p.methods]);

  // Every Subscribe Now button on the page opens the assistant directly.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-subscribe]") as HTMLElement | null;
      if (!el || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      start(el.dataset.subscribe || null, el.dataset.method, el);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [start]);
  useEffect(() => { if (p.initial?.plan) start(p.initial.plan, p.initial.method); }, [p.initial?.plan, p.initial?.method, start]);

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
    const t = setTimeout(() => {
      const body = bodyRef.current, a = anchorRef.current;
      if (body) body.scrollTo({ top: a && (method || justSent) ? Math.max(0, a.offsetTop - 8) : 0, behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [open, plan, method, justSent]);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/billing/manual", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setStatuses(j.data.statuses);
    } catch { /* keep what we have */ } finally { setChecking(false); }
  }, []);

  const current = plan ? statuses.find((s) => s.planCode === plan.code) ?? null : null;
  const blockedByPending = Boolean(current && current.status === "pending" && !justSent);
  const showStatusFirst = Boolean(current && !startOver && !justSent && current.status !== "pending");
  const methodsShown = p.methods.filter((m) => m.kind !== "card" || m.enabled);

  return (
    <>
      {open && (
        <div role="dialog" aria-modal="false" aria-labelledby={titleId}
          className="chat-panel fixed z-50 inset-0 md:inset-auto md:right-6 md:bottom-6 md:w-[440px] md:h-[min(760px,calc(100vh-48px))] flex flex-col bg-surface md:rounded-xl md:border md:border-line shadow-2xl overflow-hidden">
          <header className="bg-brand text-on-brand px-4 py-3 flex items-center gap-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}>
            <LogoMark size={34} reversed />
            <div className="grid min-w-0 flex-1">
              <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-semibold leading-6 outline-none">BETVANTA Payments</h2>
              <span className="text-xs text-sand/75 truncate">{plan ? <>{plan.name} · <span className="num">{plan.price}</span></> : "Subscribe to Premium"}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="h-10 w-10 grid place-items-center rounded-full hover:bg-white/10" aria-label="Close chat">{Icon.close}</button>
          </header>

          <div ref={bodyRef} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-5 grid content-start gap-4" aria-live="polite">
            <Bot><p>Hi{p.user ? ` ${p.user.firstName}` : ""}, welcome to BETVANTA. I&apos;ll get your Premium access set up.</p></Bot>

            {/* Plan */}
            {!plan ? (
              <Bot>
                <p>Which plan would you like?</p>
                <Chips label="Plans" items={p.plans.map((x) => ({ key: x.code, label: x.name.replace(/ Premium$/, ""), sub: x.price }))} onPick={(t) => setPlan(p.plans.find((x) => x.code === t.key)!)} />
              </Bot>
            ) : (
              <Bot>
                <p>You&apos;ve chosen:</p>
                <div className="rounded-lg bg-surface border border-line px-3 py-2.5 flex items-center justify-between gap-3">
                  <span className="grid"><span className="font-semibold">{plan.name}</span><span className="text-sm text-muted"><span className="num font-semibold text-ink">{plan.price}</span> {plan.period}</span></span>
                  <button type="button" onClick={() => { setPlan(null); setMethod(null); setJustSent(null); }} className="text-sm font-semibold text-link hover:underline">Change</button>
                </div>
              </Bot>
            )}

            {/* Existing payment for this plan */}
            {plan && current && !justSent && (current.status === "pending" || showStatusFirst) && (
              <Bot>
                <p>{current.status === "pending" ? "You already sent payment details for this plan." : current.status === "confirmed" ? "Your last payment for this plan was confirmed." : "Your last payment for this plan was not confirmed."}</p>
                <StatusCard s={current} amount={plan.price} onRefresh={refresh} busy={checking} />
                {current.status !== "pending" && <button type="button" onClick={() => setStartOver(true)} className="btn btn-secondary btn-sm w-fit">{current.status === "confirmed" ? "Renew or pay again" : "Send a new payment"}</button>}
              </Bot>)}

            {/* Method */}
            {plan && !blockedByPending && !showStatusFirst && !justSent && (
              <Bot>
                <p>How would you like to pay?</p>
                <Chips label="Payment methods" items={methodsShown.map((m) => ({ key: m.id, label: m.short, active: method?.id === m.id, sub: m.kind === "crypto" && !m.enabled ? "soon" : undefined }))}
                  onPick={(t) => setMethod(p.methods.find((m) => m.id === t.key)!)} />
              </Bot>)}

            <div ref={anchorRef} className="scroll-mt-2" />
            {plan && method && !blockedByPending && !showStatusFirst && !justSent &&
              <MethodFlow key={`${plan.code}-${method.id}`} m={method} plan={plan} p={p}
                onDone={(s) => { setStatuses((all) => [s, ...all.filter((x) => x.planCode !== s.planCode)]); setJustSent(s.reference); }} />}

            {plan && justSent && current && (<>
              <Me>I&apos;ve sent my payment details.</Me>
              <Bot>
                <p>Thank you. We verify every payment before switching on access{p.user ? <> and we&apos;ll email <strong>{p.user.email}</strong> when it&apos;s confirmed</> : null}.</p>
                <StatusCard s={current} amount={plan.price} onRefresh={refresh} busy={checking} />
                {current.status === "rejected" && <button type="button" onClick={() => { setJustSent(null); setStartOver(true); setMethod(null); }} className="btn btn-secondary btn-sm w-fit">Send a new payment</button>}
                <p className="text-sm text-muted">Questions? Message BETVANTA on Discord with your reference, or email <a className="text-link underline" href={`mailto:${p.supportEmail}`}>{p.supportEmail}</a>.</p>
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

function SignInPrompt({ p, plan, m }: { p: SubscribeAssistantProps; plan: AssistantPlan; m: AssistantMethod }) {
  const back = `${p.returnPath}?subscribe=${plan.code}&method=${m.id}`;
  return (
    <Bot>
      <p className="font-semibold">Create a free account or log in to {m.kind === "card" ? "pay" : "send your payment details"}.</p>
      <p className="text-sm text-muted">Your plan is linked to your account, so we know whose access to switch on. You&apos;ll come straight back here.</p>
      <div className="grid grid-cols-2 gap-2">
        <a href={`/register?next=${encodeURIComponent(back)}`} className="btn btn-accent">Create account</a>
        <a href={`/login?next=${encodeURIComponent(back)}`} className="btn btn-secondary">Log in</a>
      </div>
    </Bot>
  );
}

function MethodFlow({ m, plan, p, onDone }: { m: AssistantMethod; plan: AssistantPlan; p: SubscribeAssistantProps; onDone: (s: PaymentStatus) => void }) {
  const amountText = m.id === "usdt" ? `${plan.usdAmount} USDT` : `the equivalent of ${plan.price} in ${m.symbol}`;
  const manualOff = m.kind !== "card" && !p.manualReady;
  return (<>
    <Me>{m.label}</Me>
    {m.kind === "card" && (p.user ? <CardPay m={m} plan={plan} /> : <SignInPrompt p={p} plan={plan} m={m} />)}
    {manualOff && (
      <Bot>
        <p>{m.label} payments are being set up and can&apos;t be sent through the website yet. The BETVANTA team can help you pay in our official Discord.</p>
        <DiscordButton url={p.discordUrl} />
      </Bot>)}
    {!manualOff && m.kind === "crypto" && !m.enabled && (
      <Bot>
        <p>{m.unavailable === "network_unconfirmed"
          ? <><strong>{m.label}</strong> isn&apos;t available on the website yet while we confirm its network. The BETVANTA team can help you pay in our official Discord.</>
          : <><strong>{m.label}</strong> payments aren&apos;t open yet. The BETVANTA team can help you pay another way in our official Discord.</>}</p>
        <DiscordButton url={p.discordUrl} />
      </Bot>)}
    {!manualOff && m.kind === "crypto" && m.enabled && (<>
      <Bot>
        <p>Send <strong>{amountText}</strong> to the BETVANTA {m.walletName} wallet below.</p>
        <div className="rounded-lg bg-surface border border-line p-3 grid gap-3 justify-items-center">
          <div className="qr bg-white rounded-md p-2 w-[176px] h-[176px]" role="img" aria-label={`QR code for the ${m.symbol} address`} dangerouslySetInnerHTML={{ __html: m.qrSvg ?? "" }} />
          <div className="w-full grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-[.08em] text-subtle">{m.symbol} address</span>
            <code className="num text-[13px] leading-5 break-all rounded-md bg-sunken px-2.5 py-2 select-all">{m.address}</code>
          </div>
          <div className="w-full grid gap-1 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted">Plan</span><span className="font-semibold text-right">{plan.name}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Amount</span><span className="font-semibold text-right">{m.id === "usdt" ? `${plan.usdAmount} USDT (${plan.price})` : `${plan.price} in ${m.symbol}`}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Network</span><span className="font-semibold text-right">{m.network}</span></div>
          </div>
          <div className="w-full"><CopyButton text={m.address!} label="Copy address" /></div>
        </div>
      </Bot>
      <Bot>
        <p className="font-semibold">How to complete your payment</p>
        <ol className="list-decimal pl-5 grid gap-1 text-[14px]">
          <li>Copy the address or scan the QR code in your wallet app.</li>
          <li>Send {amountText} on the <strong>{m.network}</strong> network only. Check the address before you confirm.</li>
          {m.id !== "usdt" && <li>Prices move: send at least {plan.price} worth at the time you pay.</li>}
          <li>Upload a screenshot of the payment and add the transaction hash (TXID) below.</li>
        </ol>
        <p className="text-sm text-muted">We check the transaction on the blockchain before your plan is activated. A screenshot alone never activates a plan.</p>
      </Bot>
    </>)}
    {!manualOff && m.kind === "contact" && (
      <Bot>
        <p>We don&apos;t list {m.id === "other" ? "payment" : m.label} details on the website, so you never send money to an out-of-date or fake account.</p>
        <p><strong>Message BETVANTA in our official Discord</strong> for current {m.id === "other" ? "payment" : m.label} instructions. Mention the <strong>{plan.name}</strong> plan ({plan.price}).</p>
        <DiscordButton url={p.discordUrl} />
        <p className="text-sm text-muted">Then upload your payment proof below. We confirm the payment before your plan is activated.</p>
      </Bot>)}
    {!manualOff && m.kind !== "card" && (m.kind === "contact" || m.enabled) && (
      p.user ? <Bot><p className="font-semibold">Upload your payment proof</p><ProofForm m={m} plan={plan} user={p.user} onDone={onDone} /></Bot>
        : <SignInPrompt p={p} plan={plan} m={m} />)}
  </>);
}

function CardPay({ m, plan }: { m: AssistantMethod; plan: AssistantPlan }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go(provider: string) {
    setBusy(provider); setErr(null);
    try {
      const r = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCode: plan.code, provider }) });
      const j = await r.json().catch(() => ({ ok: false, error: { message: "Unexpected response." } }));
      if (!j.ok) { setErr(j.error?.message ?? "Could not start card payment."); return; }
      window.location.href = j.data.next;
    } catch { setErr("Network error. Check your connection and try again."); } finally { setBusy(null); }
  }
  return (
    <Bot>
      <p>You&apos;ll pay <strong>{plan.price}</strong> on the card provider&apos;s secure page. Card details never reach BETVANTA, and your plan switches on when the provider confirms the payment to us.</p>
      <div className="flex flex-wrap gap-2">{(m.providers ?? []).map((pr, i) => <button key={pr.id} type="button" disabled={Boolean(busy)} onClick={() => go(pr.id)} className={`btn ${i === 0 ? "btn-accent" : "btn-secondary"}`}>{busy === pr.id ? "Opening" : `Pay with ${pr.label}`}</button>)}</div>
      {err && <p role="alert" className="text-sm font-medium text-danger">{err}{/verify/i.test(err) && <> <a href="/verify-email" className="underline">Resend the verification email</a>.</>}</p>}
    </Bot>
  );
}

function ProofForm({ m, plan, user, onDone }: { m: AssistantMethod; plan: AssistantPlan; user: NonNullable<SubscribeAssistantProps["user"]>; onDone: (s: PaymentStatus) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string[]>>({});
  const [file, setFile] = useState<File | null>(null);
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFieldErr((x) => ({ ...x, proof: [] }));
    if (f && f.size > 4 * 1024 * 1024) { setFieldErr((x) => ({ ...x, proof: ["Maximum 4 MB. Upload a smaller screenshot."] })); e.target.value = ""; setFile(null); return; }
    setFile(f);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!file) fd.delete("proof");
    fd.set("planCode", plan.code); fd.set("method", m.id);
    setBusy(true); setErr(null); setFieldErr({});
    try {
      const res = await fetch("/api/billing/manual", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({ ok: false, error: { message: "Unexpected response. Try again." } }));
      if (!j.ok) { setErr(j.error?.message ?? "Could not send your details."); setFieldErr(j.error?.details ?? {}); return; }
      onDone({ reference: j.data.reference, planCode: plan.code, method: m.id === "other" ? String(fd.get("methodOther") || m.label) : m.label, status: "pending", reason: null, at: new Date().toISOString() });
    } catch { setErr("Network error. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  const hint = (k: string) => fieldErr[k]?.length ? <span id={id(`${k}-e`)} className="text-[13px] text-danger">{fieldErr[k].join(" ")}</span> : null;
  const desc = (k: string, h?: string) => [h, fieldErr[k]?.length ? id(`${k}-e`) : null].filter(Boolean).join(" ") || undefined;
  const label = "text-[13px] font-semibold";
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg bg-surface border border-line p-3" noValidate>
      <div className="grid gap-1.5">
        <input id={id("proof")} name="proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={pick} className="sr-only" aria-describedby={desc("proof", id("proof-h"))} />
        <label htmlFor={id("proof")} className="btn btn-accent w-full cursor-pointer">{Icon.upload}{file ? "Change payment proof" : "Upload payment proof"}</label>
        <span id={id("proof-h")} className="text-[12px] text-subtle text-center">{file ? <>Selected: <strong className="text-ink break-all">{file.name}</strong></> : "Screenshot or PDF of the payment, PNG, JPG, WebP or PDF up to 4 MB"}</span>{hint("proof")}
      </div>
      <div className="grid gap-1"><label htmlFor={id("ref")} className={label}>{m.kind === "crypto" ? "Transaction hash (TXID)" : "Payment ID or reference"}</label>
        <input id={id("ref")} name="reference" className="input num text-[13px]" maxLength={200} autoCapitalize="none" spellCheck={false} aria-describedby={desc("reference", id("ref-h"))} />
        <span id={id("ref-h")} className="text-[12px] text-subtle">{m.kind === "crypto" ? "Needed to check the payment on the blockchain. Find it in your wallet\u2019s transaction details." : "Add this, the proof upload, or both."}</span>{hint("reference")}</div>
      {m.id === "other" && <div className="grid gap-1"><label htmlFor={id("other")} className={label}>Payment method</label>
        <input id={id("other")} name="methodOther" className="input" required maxLength={40} placeholder="for example Cash App" aria-describedby={desc("methodOther")} />{hint("methodOther")}</div>}
      <div className="grid gap-1"><label htmlFor={id("name")} className={label}>Full name</label>
        <input id={id("name")} name="fullName" className="input" autoComplete="name" required defaultValue={user.displayName} aria-describedby={desc("fullName")} />{hint("fullName")}</div>
      <div className="grid gap-1"><label htmlFor={id("email")} className={label}>Email</label>
        <input id={id("email")} name="email" type="email" className="input" autoComplete="email" required defaultValue={user.email} aria-describedby={desc("email")} />{hint("email")}</div>
      <div className="grid gap-1"><label htmlFor={id("discord")} className={label}>Discord username</label>
        <input id={id("discord")} name="discordUsername" className="input" required placeholder="for example tom_bv" autoCapitalize="none" spellCheck={false} aria-describedby={desc("discordUsername")} />{hint("discordUsername")}</div>
      <div className="grid gap-1"><label htmlFor={id("note")} className={label}>Note <span className="font-normal text-subtle">(optional)</span></label>
        <textarea id={id("note")} name="note" className="input min-h-[56px]" maxLength={1000} /></div>
      {err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy && <span aria-hidden className="h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />}Submit for verification</button>
      <p className="text-[12px] text-subtle">Your plan is activated only after we confirm the payment.</p>
    </form>
  );
}
