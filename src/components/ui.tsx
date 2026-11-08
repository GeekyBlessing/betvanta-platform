import type { ReactNode } from "react";
import Link from "next/link";

/* BETVANTA logo: the client's artwork, cropped and resized by scripts/artwork/brand-assets.py (never redrawn).
   Transparent PNGs made against black, so they match the original exactly on the black header, footer and panels. */
const MARK_RATIO = 116 / 96, WORD_RATIO = 448 / 64, LOCKUP_RATIO = 648 / 400;
/* eslint-disable @next/next/no-img-element -- small static brand PNGs with explicit sizes; next/image adds nothing here */
export function LogoMark({ size = 28 }: { size?: number; reversed?: boolean }) {
  return <img src="/brand/betvanta-mark-96.png" alt="" aria-hidden="true" width={Math.round(size * MARK_RATIO)} height={size} className="shrink-0" style={{ width: Math.round(size * MARK_RATIO), height: size }} />;
}
/** Header logo: the B mark with the BETVANTA wordmark beside it. `size` is the mark's height in pixels. */
export function Logo({ size = 36, href = "/" }: { size?: number; href?: string; onDark?: boolean }) {
  const wordH = Math.round(size * 0.5);
  return (
    <Link href={href} className="brand-logo inline-flex items-center gap-2 shrink-0" aria-label="BETVANTA home">
      <LogoMark size={size} />
      <img src="/brand/betvanta-wordmark-64.png" alt="BETVANTA" width={Math.round(wordH * WORD_RATIO)} height={wordH} className="brand-word" style={{ width: Math.round(wordH * WORD_RATIO), height: wordH }} />
    </Link>
  );
}
/** The full stacked logo (mark, wordmark, tagline), for the footer and sign-in panels. `height` in pixels. */
export function LogoLockup({ height = 120, href }: { height?: number; href?: string }) {
  const img = <img src="/brand/betvanta-lockup-400.png" alt="BETVANTA: Sports, Predictions, Betting" width={Math.round(height * LOCKUP_RATIO)} height={height} style={{ width: Math.round(height * LOCKUP_RATIO), height }} />;
  return href ? <Link href={href} aria-label="BETVANTA home" className="inline-block">{img}</Link> : img;
}
/* eslint-enable @next/next/no-img-element */

const tones = {
  neutral: "bg-sunken text-muted", teal: "bg-teal-subtle text-link", copper: "bg-accent-subtle text-accent-text", brand: "bg-brand text-on-brand",
  success: "bg-success-subtle text-success", danger: "bg-danger-subtle text-danger", warning: "bg-warning-subtle text-warning",
} as const;
export function Badge({ tone = "neutral", dot, children }: { tone?: keyof typeof tones; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}{children}
    </span>
  );
}
export const tierBadge = (t: string) => <Badge tone={t === "vip" ? "brand" : t === "premium" ? "copper" : "teal"}>{t === "vip" ? "VIP" : t === "premium" ? "Premium" : "Free"}</Badge>;
export const resultBadge = (r: string) => r === "won" ? <Badge tone="success" dot>Won</Badge> : r === "lost" ? <Badge tone="danger" dot>Lost</Badge> : r === "void" ? <Badge dot>Void</Badge> : <Badge tone="warning" dot>Pending</Badge>;
export const SampleBadge = () => <Badge tone="warning">Sample data</Badge>;

export function Confidence({ band }: { band: string | null }) {
  if (!band) return null;
  const n = band === "high" ? 3 : band === "medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted" role="img" aria-label={`${band} confidence`}>
      <span className="inline-flex items-end gap-[3px]" aria-hidden>
        {[8, 12, 16].map((h, i) => <i key={h} className="block w-[5px] rounded-[1px]" style={{ height: h, background: i < n ? (band === "high" ? "var(--accent)" : "var(--link)") : "var(--chart-grid)" }} />)}
      </span>
      <span>{band[0].toUpperCase() + band.slice(1)} confidence</span>
    </span>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children: ReactNode }) {
  const bg = { info: "bg-teal-subtle", warning: "bg-warning-subtle", danger: "bg-danger-subtle", success: "bg-success-subtle" }[tone];
  return <div role={tone === "danger" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-sm ${bg}`}>{title && <strong className="font-semibold">{title} </strong>}{children}</div>;
}

export function Stat({ label, value, foot }: { label: string; value: string; foot?: ReactNode }) {
  return (
    <div className="card p-5 grid gap-2 min-w-0">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className="num text-[30px] leading-9 font-semibold tracking-tight">{value}</span>
      {foot && <span className="text-xs text-subtle">{foot}</span>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="grid gap-2 mb-8">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 className="display text-[28px] leading-[34px] md:text-[36px] md:leading-[40px] font-bold">{title}</h1>
      {children && <div className="text-muted max-w-[65ch]">{children}</div>}
    </div>
  );
}

export const RG_LINE = "Predictions are analysis, not guarantees. 18+ only. Gambling problem? Call 1-800-GAMBLER.";
const TZ = () => process.env.APP_TIMEZONE || "America/New_York";
export const fmtKickoff = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ(), timeZoneName: "short" }).format(new Date(iso));
/** Lifetime subscriptions end at Postgres "infinity" (Infinity in JS); show them as "Lifetime". */
export const fmtDate = (iso: string | number | Date) => { const d = new Date(iso); return isNaN(d.getTime()) ? "Lifetime" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ() }).format(d); };
export const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ() }).format(new Date(iso));
export const fmtDay = (iso: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: TZ() }).format(new Date(iso));
export const tzLabel = () => new Intl.DateTimeFormat("en-US", { timeZone: TZ(), timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? TZ();
