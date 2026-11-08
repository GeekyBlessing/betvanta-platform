import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui";
import { LogoutButton } from "./LogoutButton";

export function Shell({ nav, user, children, area }: { nav: { href: string; label: string }[]; user: { display_name: string; role: string }; children: ReactNode; area: string }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[240px_1fr]">
      <aside className="bg-surface border-b lg:border-b-0 lg:border-r border-line lg:min-h-screen">
        <div className="p-4 lg:p-6 flex lg:flex-col gap-4 lg:gap-8 items-center lg:items-stretch justify-between">
          <Logo size={26} />
          <nav aria-label={area} className="hidden lg:grid gap-1">
            {nav.map((n) => <Link key={n.href} href={n.href} className="px-3 py-2 rounded-md text-sm font-medium text-muted hover:text-ink hover:bg-sunken">{n.label}</Link>)}
          </nav>
          <div className="flex lg:flex-col lg:items-start gap-2"><LogoutButton /></div>
        </div>
        <nav aria-label={`${area} mobile`} className="lg:hidden flex gap-1 overflow-x-auto px-4 pb-3">
          {nav.map((n) => <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-md text-sm font-medium text-muted whitespace-nowrap hover:bg-sunken">{n.label}</Link>)}
        </nav>
      </aside>
      <main id="main" className="min-w-0 p-4 md:p-8">
        <div className="flex justify-end text-xs text-subtle mb-4">Signed in as {user.display_name} · <span className="capitalize ml-1">{user.role}</span></div>
        <div className="max-w-[1100px]">{children}</div>
      </main>
    </div>
  );
}
