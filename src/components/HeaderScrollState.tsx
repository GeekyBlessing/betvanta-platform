"use client";
import { useEffect } from "react";
/** Marks the overlay header as scrolled so CSS can give it a solid background over page content. */
export function HeaderScrollState({ targetId }: { targetId: string }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const on = () => { if (window.scrollY > 24) el.setAttribute("data-scrolled", ""); else el.removeAttribute("data-scrolled"); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [targetId]);
  return null;
}
