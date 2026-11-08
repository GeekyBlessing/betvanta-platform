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
  const msg = String(err?.message ?? "");
  if (/EMAXCONNSESSION|max clients reached in session mode/i.test(msg))
    return "Supabase's session pooler is full (it allows pool_size clients, 15 on this plan, shared by everything that uses port 5432). The usual cause is the website itself using the session pooler: set Vercel's DATABASE_URL to the betvanta_app Transaction pooler string (port 6543, user betvanta_app.<ref>), redeploy, then run this workflow again. See docs/SUPABASE.md.";
  if (/Tenant or user not found/i.test(msg)) return "The pooler does not recognise this user: the username must be <role>.<project-ref> (for example postgres.<ref>) and the host must be your project's pooler region.";
  if (/circuit breaker/i.test(msg)) return "The pooler has paused logins after repeated failures. Wait a few minutes, check the password, then retry.";
  if (code === "28P01") return "Password authentication failed: check the password in the connection string (URL-encode special characters).";
  if (code === "ENOTFOUND") return "Host not found: check the connection string host.";
  return "";
}

/** The error as Postgres or the pooler reported it, with anything that looks like a connection string or password removed. */
export function describeConnectError(err) {
  const raw = `${err?.code ? err.code + ": " : ""}${err?.message ?? err}`;
  return raw.replace(/postgres(ql)?:\/\/\S+/gi, "<connection string>").replace(/password=\S+/gi, "password=<hidden>").slice(0, 300);
}
