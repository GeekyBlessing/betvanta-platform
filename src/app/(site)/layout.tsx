import { PublicShell } from "@/components/SiteChrome";
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell><div className="pb-16">{children}</div></PublicShell>;
}
