import { permanentRedirect } from "next/navigation";
export const dynamic = "force-dynamic";
/** The plans page is now /packages. Old links (and payment providers' cancel URLs) keep working, query intact. */
export default async function PricingMoved(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of [v].flat()) if (typeof x === "string") qs.append(k, x);
  permanentRedirect(`/packages${qs.size ? `?${qs}` : ""}`);
}
