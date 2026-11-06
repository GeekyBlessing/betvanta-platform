"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function FavouriteToggle({ competitionId, initial }: { competitionId: string; initial: boolean }) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  const r = useRouter();
  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/account/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competitionId, favourite: !fav }) });
    if (res.ok) { setFav(!fav); r.refresh(); }
    setBusy(false);
  }
  return <button type="button" disabled={busy} onClick={toggle} aria-pressed={fav} className={`btn btn-sm ${fav ? "btn-primary" : "btn-secondary"}`}>{fav ? "★ In my leagues" : "☆ Add to my leagues"}</button>;
}
