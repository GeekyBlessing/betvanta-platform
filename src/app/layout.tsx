import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "BETVANTA | Smarter Insights. Better Decisions.", template: "%s | BETVANTA" },
  description: "BETVANTA: sports intelligence, match predictions and analytics. Smarter Insights. Better Decisions.",
  applicationName: "BETVANTA",
  openGraph: { siteName: "BETVANTA", type: "website", title: "BETVANTA", description: "Sports intelligence, match predictions and analytics. Smarter Insights. Better Decisions." },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#123D3B", width: "device-width", initialScale: 1, viewportFit: "cover" };

// Applies a saved theme before paint to avoid a flash; falls back to the system setting.
const themeScript = `try{var t=localStorage.getItem('bv-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
