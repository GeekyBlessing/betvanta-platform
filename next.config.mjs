/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self' https://checkout.paystack.com",
      "base-uri 'self'",
    ].join("; "),
  },
];
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  // The public site follows the client's reference (Home, Packages, Contact). Retired public pages go home.
  async redirects() {
    return ["/predictions", "/virtuals", "/search", "/fixtures", "/results", "/performance", "/community", "/about", "/faq"]
      .map((source) => ({ source, destination: "/", permanent: false }));
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Uploaded payment proofs (admin only): render as an inert document. Later rules override earlier ones for the same key.
      { source: "/api/admin/manual-payments/proofs/:id", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }] },
    ];
  },
};
export default nextConfig;
