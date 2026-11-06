"use client";
import { useRouter } from "next/navigation";
export function LogoutButton() {
  const r = useRouter();
  return <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); r.push("/"); r.refresh(); }}>Log out</button>;
}
