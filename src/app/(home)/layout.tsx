import { PublicShell } from "@/components/SiteChrome";
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
