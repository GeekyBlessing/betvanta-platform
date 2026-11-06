import Link from "next/link";
export default function NotFound() {
  return <main className="wrap py-24 grid gap-4 max-w-[560px]"><span className="eyebrow">404</span><h1 className="display text-[28px] font-bold">This page is not here</h1><p className="text-muted">The link may be old or mistyped.</p><Link href="/" className="btn btn-primary w-fit">Back to BETVANTA</Link></main>;
}
