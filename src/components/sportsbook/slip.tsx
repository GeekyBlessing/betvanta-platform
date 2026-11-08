"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Bet slip. Selections and stakes live in this browser only. Prices are BETVANTA model prices shown for demonstration;
 * nothing is sent anywhere and no bet can be placed (real-money betting is disabled on BETVANTA).
 */
export type Selection = { id: string; fixtureId: string; match: string; market: string; outcome: string; price: number; kickoff: string };
type Ctx = {
  items: Selection[]; toggle: (s: Selection) => void; remove: (id: string) => void; clear: () => void; has: (fixtureId: string, market: string, outcome: string) => boolean;
  open: boolean; setOpen: (o: boolean) => void;
};
const SlipCtx = createContext<Ctx | null>(null);
const KEY = "bv-slip";

export function SlipProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Selection[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) setItems((JSON.parse(raw) as Selection[]).filter((s) => new Date(s.kickoff) > new Date())); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }, [items]);
  const toggle = useCallback((s: Selection) => setItems((cur) => {
    const same = cur.find((x) => x.id === s.id);
    if (same && same.outcome === s.outcome) return cur.filter((x) => x.id !== s.id);
    return [...cur.filter((x) => x.id !== s.id), s].slice(-20);
  }), []);
  const value = useMemo<Ctx>(() => ({
    items, toggle, open, setOpen,
    remove: (id) => setItems((cur) => cur.filter((x) => x.id !== id)),
    clear: () => setItems([]),
    has: (f, m, o) => items.some((x) => x.fixtureId === f && x.market === m && x.outcome === o),
  }), [items, toggle, open]);
  return <SlipCtx.Provider value={value}>{children}</SlipCtx.Provider>;
}
export function useSlip() {
  const c = useContext(SlipCtx);
  if (!c) throw new Error("useSlip outside SlipProvider");
  return c;
}

/** One price. Selected prices turn red; locked or missing prices are not buttons. */
export function OddsButton({ fixtureId, match, market, outcome, label, price, kickoff, compact = false }: {
  fixtureId: string; match: string; market: string; outcome: string; label: string; price: number; kickoff: string; compact?: boolean;
}) {
  const { toggle, has } = useSlip();
  const on = has(fixtureId, market, outcome);
  return (
    <button type="button" aria-pressed={on} onClick={() => toggle({ id: `${fixtureId}:${market}`, fixtureId, match, market, outcome, price, kickoff })}
      aria-label={`${match}, ${market}: ${outcome} at ${price.toFixed(2)}`} className={`odds-btn ${on ? "is-on" : ""} ${compact ? "odds-compact" : ""}`}>
      <span className="odds-label">{label}</span><span className="odds-price">{price.toFixed(2)}</span>
    </button>
  );
}

const money = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00");

export function BetSlip({ onClose }: { onClose?: () => void }) {
  const { items, remove, clear } = useSlip();
  const [mode, setMode] = useState<"single" | "multiple">("multiple");
  const [stake, setStake] = useState("10");
  const s = Math.max(0, Number(stake) || 0);
  const related = new Set(items.map((i) => i.fixtureId)).size !== items.length;
  const multipleOk = items.length > 1 && !related;
  const effective = mode === "multiple" && !multipleOk ? "single" : mode;
  const totalOdds = items.reduce((a, i) => a * i.price, 1);
  const totalStake = effective === "single" ? s * items.length : s;
  const returns = effective === "single" ? items.reduce((a, i) => a + s * i.price, 0) : s * totalOdds;
  return (
    <section className="slip" aria-labelledby="slip-h">
      <header className="slip-head">
        <h2 id="slip-h" className="flex items-center gap-2">Bet Slip <span className="slip-count">{items.length}</span></h2>
        <div className="flex items-center gap-3">
          {items.length > 0 && <button type="button" onClick={clear} className="text-[12px] font-semibold text-muted hover:text-white">Remove all</button>}
          {onClose && <button type="button" onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-white/10" aria-label="Close bet slip">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
        </div>
      </header>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center grid gap-2">
          <p className="font-semibold">Your bet slip is empty</p>
          <p className="text-[13px] text-muted">Tap a price to add it here and see the combined odds and potential return.</p>
        </div>
      ) : (<>
        <div className="slip-tabs" role="tablist" aria-label="Bet type">
          {(["single", "multiple"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={effective === m} disabled={m === "multiple" && !multipleOk} onClick={() => setMode(m)}
              className={`slip-tab ${effective === m ? "is-on" : ""}`}>{m === "single" ? "Singles" : "Multiple"}</button>))}
        </div>
        {related && <p className="px-4 pt-2 text-[12px] text-warning">Two selections from the same match cannot be combined. Remove one to build a multiple.</p>}
        <ul className="slip-list">
          {items.map((i) => (
            <li key={i.id} className="slip-item">
              <button type="button" onClick={() => remove(i.id)} className="slip-x" aria-label={`Remove ${i.outcome}, ${i.match}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
              <div className="min-w-0 grid gap-0.5">
                <span className="font-semibold text-[14px]">{i.outcome}</span>
                <span className="text-[12px] text-muted truncate">{i.match}</span>
                <span className="text-[12px] text-subtle">{i.market}</span>
              </div>
              <span className="num font-bold text-[15px]">{i.price.toFixed(2)}</span>
            </li>))}
        </ul>
        <div className="slip-foot">
          <div className="flex items-center justify-between text-[13px]"><span className="text-muted">{effective === "multiple" ? "Total odds" : "Bets"}</span><span className="num font-semibold">{effective === "multiple" ? totalOdds.toFixed(2) : items.length}</span></div>
          <label className="flex items-center justify-between gap-3 text-[13px]">
            <span className="text-muted">{effective === "single" ? "Stake per bet" : "Stake"}</span>
            <span className="slip-stake"><span aria-hidden className="text-subtle">$</span><input inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, "").slice(0, 9))} aria-label="Stake in US dollars" /></span>
          </label>
          <div className="flex flex-wrap gap-1.5">{["5", "10", "25", "50", "100"].map((v) => <button key={v} type="button" onClick={() => setStake(v)} className={`slip-chip ${stake === v ? "is-on" : ""}`}>${v}</button>)}</div>
          <div className="flex items-center justify-between text-[13px]"><span className="text-muted">Total stake</span><span className="num">${money(totalStake)}</span></div>
          <div className="flex items-center justify-between"><span className="font-semibold">Potential return</span><span className="num font-bold text-[18px]">${money(returns)}</span></div>
          <button type="button" disabled className="btn btn-accent w-full" aria-describedby="slip-note">Place Bet</button>
          <p id="slip-note" className="text-[11px] leading-4 text-subtle">Betting is not available on BETVANTA. Prices are BETVANTA model prices (1 ÷ model probability) shown for demonstration, not bookmaker odds. Get the full picks and analysis with a package.</p>
          <Link href="/packages" className="btn btn-secondary btn-sm w-full">View Packages</Link>
        </div>
      </>)}
    </section>
  );
}

/** Phones: a floating slip button above the bottom navigation that opens the slip as a bottom sheet. */
export function MobileSlip() {
  const { items, open, setOpen } = useSlip();
  const odds = items.reduce((a, i) => a * i.price, 1);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, setOpen]);
  return (<>
    {items.length > 0 && !open && (
      <button type="button" className="slip-fab lg:hidden" onClick={() => setOpen(true)} aria-label={`Open bet slip, ${items.length} selections`}>
        <span className="slip-fab-count">{items.length}</span><span className="num">{odds.toFixed(2)}</span>
      </button>)}
    {open && (
      <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Bet slip">
        <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close bet slip" onClick={() => setOpen(false)} />
        <div className="slip-sheet"><BetSlip onClose={() => setOpen(false)} /></div>
      </div>)}
  </>);
}

/** Desktop: the slip sits in the right-hand column. */
export function DesktopSlip() {
  return <div className="hidden lg:block sticky top-[124px]"><BetSlip /></div>;
}
