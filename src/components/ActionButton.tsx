"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
/** One-click API action (publish, sync, re-verify). Shows the server's message and refreshes the page data. */
export function ActionButton({ action, method = "POST", payload, label, variant = "secondary", confirmText }: { action: string; method?: "POST" | "PATCH"; payload?: Record<string, unknown>; label: string; variant?: string; confirmText?: string }) {
  const r = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [armed, setArmed] = useState(false);
  async function go() {
    if (confirmText && !armed) { setArmed(true); return; }
    setBusy(true); setMsg(null); setArmed(false);
    try {
      const res = await fetch(action, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload ?? {}) });
      const j = await res.json().catch(() => ({ ok: false, error: { message: "Unexpected response." } }));
      setMsg({ ok: j.ok, t: j.ok ? (j.data?.message ?? "Done.") : j.error?.message ?? "Failed." });
      if (j.ok) r.refresh();
    } finally { setBusy(false); }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={go} className={`btn btn-sm btn-${armed ? "danger" : variant}`}>{armed ? confirmText : label}</button>
      {msg && <span role="status" className={`text-xs font-medium ${msg.ok ? "text-success" : "text-danger"}`}>{msg.t}</span>}
    </span>
  );
}
