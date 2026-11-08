import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (<><SiteHeader /><main id="main" className="flex-1">{children}</main><SiteFooter /></>);
}
