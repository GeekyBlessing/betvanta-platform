import { discordInviteUrl, instagramUrl } from "@/lib/env";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { support } from "@/lib/support";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "BETVANTA | Smarter Insights. Better Decisions.", template: "%s | BETVANTA" },
  description: "BETVANTA: sports intelligence, match predictions and analytics. Smarter Insights. Better Decisions.",
  applicationName: "BETVANTA",
  openGraph: { siteName: "BETVANTA", type: "website", title: "BETVANTA", description: "Sports intelligence, match predictions and analytics. Smarter Insights. Better Decisions." },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#0B0B0D", width: "device-width", initialScale: 1, viewportFit: "cover" };



function orgJsonLd() {
  const s = support();
  const data = { "@context": "https://schema.org", "@type": "Organization", name: "BETVANTA", slogan: "Smarter Insights. Better Decisions.", url: process.env.APP_URL,
    sameAs: [discordInviteUrl(), instagramUrl()].filter(Boolean),
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: s.email, telephone: s.phoneHref.replace("tel:", ""), areaServed: "US", availableLanguage: "English" }] };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJsonLd() }} />
      </head>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
