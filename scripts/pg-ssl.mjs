// Shared TLS settings for Postgres connections (app, migrations, checks).
// Supabase requires TLS. If DATABASE_CA_CERT (PEM text) is set, the server certificate is fully verified;
// otherwise the connection is encrypted but the certificate chain is not checked (sslmode=require behaviour).
export function sslFor(url) {
  const remote = /sslmode=(require|verify)|supabase\.(co|com)|pooler\.supabase|neon\.tech|render\.com/.test(url);
  const ca = process.env.DATABASE_CA_CERT;
  if (ca) return { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true };
  return remote ? { rejectUnauthorized: false } : undefined;
}
/** node-pg treats sslmode in the URL as authoritative and would override our ssl object; strip it. */
export const stripSslMode = (url) => url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");

/** Supabase's direct host (db.<ref>.supabase.co) is IPv6-only; Vercel and GitHub runners are IPv4. */
export const isSupabaseDirectHost = (url) => { try { return /^db\.[a-z0-9]+\.supabase\.co$/.test(new URL(url).hostname); } catch { return false; } };
export function connectionHint(err, url) {
  const code = err?.code ?? "";
  if (isSupabaseDirectHost(url) || ["ENETUNREACH", "EHOSTUNREACH"].includes(code))
    return "This looks like Supabase's direct host (db.<ref>.supabase.co), which is IPv6-only. Use the Supavisor pooler string instead: Supabase > Connect > Session pooler (port 5432) for migrations, Transaction pooler (port 6543) for the app. See docs/SUPABASE.md.";
  if (code === "28P01") return "Password authentication failed: check the password in the connection string (URL-encode special characters).";
  if (code === "ENOTFOUND") return "Host not found: check the connection string host.";
  return "";
}
