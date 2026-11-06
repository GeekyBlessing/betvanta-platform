import { NextResponse, type NextRequest } from "next/server";
// CSRF defence for cookie-authenticated API calls: state-changing requests must come from our own origin.
// Webhooks (signed) and cron (bearer secret) are exempt.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return NextResponse.next();
  if (pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/cron/")) return NextResponse.next();
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ ok: false, error: { code: "bad_origin", message: "Cross-site request blocked." } }, { status: 403 });
  }
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
