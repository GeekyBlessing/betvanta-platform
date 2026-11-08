import { Logo, LogoLockup, RG_LINE } from "@/components/ui";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid md:grid-cols-[1fr_1.1fr]">
      <aside className="hidden md:flex flex-col justify-between bg-black text-on-brand p-10 border-r-2 border-red">
        <LogoLockup height={150} href="/" />
        <div className="grid gap-4 max-w-[40ch]">
          <p className="display text-[32px] leading-[36px] font-bold">Smarter Insights. Better Decisions.</p>
          <p className="opacity-85">Data-driven predictions with stated confidence and an open, locked-at-kickoff track record.</p>
        </div>
        <p className="text-xs opacity-75">{RG_LINE}</p>
      </aside>
      <main id="main" className="flex flex-col p-6 md:p-10">
        <div className="mb-10 md:hidden"><Logo size={36} /></div>
        <div className="w-full max-w-[420px] mx-auto my-auto">{children}</div>
      </main>
    </div>
  );
}
