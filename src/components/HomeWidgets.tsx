"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/** Counts a figure up from zero when it scrolls into view ("2,000", "75%"). Shows the final value without JavaScript. */
export function CountUp({ value }: { value: string }) {
  const m = value.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
  const target = m ? Number(m[2].replace(/,/g, "")) : NaN;
  const [shown, setShown] = useState(value);
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!m || !Number.isFinite(target) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const decimals = (m[2].split(".")[1] ?? "").length;
    const fmt = (n: number) => `${m[1]}${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${m[3]}`;
    let raf = 0;
    const run = () => {
      const start = performance.now(), dur = 1400;
      const tick = (t: number) => { const p = Math.min(1, (t - start) / dur); setShown(fmt(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); setShown(fmt(0)); run(); } }, { threshold: 0.4 });
    if (el.current) io.observe(el.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span ref={el} aria-label={value}>{shown}</span>;
}

/** "Refresh Testimonials": reloads the approved reviews and shows when they were last fetched. */
export function RefreshTestimonials() {
  const router = useRouter();
  const [at, setAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const mins = Math.floor((now - at) / 60_000);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(() => { router.refresh(); setAt(Date.now()); setNow(Date.now()); })}>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pending ? "animate-spin" : ""}><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" /></svg>
        Refresh Testimonials
      </button>
      <span className="text-[12px] text-subtle" aria-live="polite">Last updated: {mins < 1 ? "just now" : `${mins} minute${mins === 1 ? "" : "s"} ago`}</span>
    </div>
  );
}
