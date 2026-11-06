"use client";
import { useEffect, useState } from "react";
export function ThemeToggle() {
  const [t, setT] = useState<"system" | "light" | "dark">("system");
  useEffect(() => { try { const s = localStorage.getItem("bv-theme"); if (s === "light" || s === "dark") setT(s); } catch {} }, []);
  function cycle() {
    const n = t === "system" ? "dark" : t === "dark" ? "light" : "system";
    setT(n);
    try { n === "system" ? localStorage.removeItem("bv-theme") : localStorage.setItem("bv-theme", n); } catch {}
    if (n === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", n);
  }
  return <button type="button" onClick={cycle} className="btn btn-ghost btn-sm" aria-label={`Theme: ${t}. Change theme`}>{t === "system" ? "Auto" : t === "dark" ? "Dark" : "Light"}</button>;
}
