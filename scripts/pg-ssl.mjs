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
