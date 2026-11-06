import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
// The homepage has its own layout so the header can sit on top of the hero image.
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (<><SiteHeader overlay /><main id="main" className="flex-1">{children}</main><SiteFooter /></>);
}
