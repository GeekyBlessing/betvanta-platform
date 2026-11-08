import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
// The subscription journey now runs in the payment assistant on the plans page. Old checkout links (emails, bookmarks)
// open the assistant for the same plan; card payments, crypto and Discord-arranged methods are all offered there.
export default async function Checkout(props: { params: Promise<{ plan: string }>; searchParams: Promise<{ method?: string }> }) {
  const { plan } = await props.params;
  const { method } = await props.searchParams;
  const code = /^[a-z0-9_]{3,40}$/.test(plan) ? plan : "";
  const m = method && /^[a-z_]{2,12}$/.test(method) ? `&method=${method}` : "";
  redirect(code ? `/packages?subscribe=${code}${m}` : "/packages");
}
