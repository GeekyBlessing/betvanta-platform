"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

type Props = {
  action: string; method?: "POST" | "PATCH" | "DELETE"; children?: ReactNode; submitLabel: string;
  variant?: "accent" | "primary" | "secondary" | "danger"; className?: string; extra?: Record<string, unknown>;
  redirectTo?: string; followNext?: boolean; refresh?: boolean; size?: "sm" | "md" | "lg"; block?: boolean; resetOnSuccess?: boolean;
};

/** Submits a form as JSON to our API, shows field errors, then redirects or refreshes server data. */
export function ApiForm({ action, method = "POST", children, submitLabel, variant = "primary", className = "grid gap-4", extra, redirectTo, followNext = true, refresh = true, size = "md", block, resetOnSuccess }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string[]>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data: Record<string, unknown> = { ...extra };
    for (const el of Array.from(form.elements) as HTMLInputElement[]) {
      if (!el.name || el.disabled) continue;
      if (el.type === "checkbox") data[el.name] = el.checked;
      else if (el.type === "radio") { if (el.checked) data[el.name] = el.value; }
      else if (el.value !== "" || el.dataset.keepEmpty) data[el.name] = el.value;
    }
    setBusy(true); setMsg(null); setFieldErr({});
    try {
      const res = await fetch(action, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const j = await res.json().catch(() => ({ ok: false, error: { message: "Unexpected response." } }));
      if (!j.ok) { setMsg({ tone: "err", text: j.error?.message ?? "Request failed." }); setFieldErr(j.error?.details ?? {}); return; }
      const next = redirectTo ?? (followNext ? j.data?.next : undefined);
      if (next) { if (/^https?:/.test(next)) window.location.href = next; else { router.push(next); router.refresh(); } return; }
      if (j.data?.message) setMsg({ tone: "ok", text: j.data.message });
      if (resetOnSuccess) form.reset();
      if (refresh) router.refresh();
    } catch { setMsg({ tone: "err", text: "Network error. Check your connection and try again." }); }
    finally { setBusy(false); }
  }

  const errs = Object.entries(fieldErr);
  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      {children}
      {errs.length > 0 && <ul className="text-sm text-danger grid gap-1">{errs.map(([k, v]) => <li key={k}><strong className="capitalize">{k.replace(/([A-Z])/g, " $1").toLowerCase()}:</strong> {v.join(" ")}</li>)}</ul>}
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`text-sm font-medium ${msg.tone === "err" ? "text-danger" : "text-success"}`}>{msg.text}</p>}
      <div><button type="submit" disabled={busy} className={`btn btn-${variant} ${size !== "md" ? `btn-${size}` : ""} ${block ? "w-full" : ""}`}>{busy && <span aria-hidden className="h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />}{submitLabel}</button></div>
    </form>
  );
}

export function Field({ label, name, type = "text", hint, ...rest }: { label: string; name: string; type?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${name}`;
  return (
    <div className="grid gap-1.5 min-w-0">
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} name={name} type={type} className="input" aria-describedby={hint ? `${id}-h` : undefined} {...rest} />
      {hint && <span id={`${id}-h`} className="text-[13px] text-subtle">{hint}</span>}
    </div>
  );
}
export function Check({ name, children, defaultChecked }: { name: string; children: ReactNode; defaultChecked?: boolean }) {
  return <label className="flex gap-3 items-start text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-4 w-4 accent-[var(--primary)]" /><span>{children}</span></label>;
}
