import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (<><SiteHeader /><main id="main" className="flex-1 pb-16">{children}</main><SiteFooter /></>);
}
