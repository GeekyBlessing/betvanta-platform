"use client";
export default function Error({ reset }: { reset: () => void }) {
  return <main className="wrap py-24 grid gap-4 max-w-[560px]"><h1 className="display text-[28px] font-bold">Something went wrong</h1><p className="text-muted">We could not load this page. Try again in a moment.</p><button className="btn btn-primary w-fit" onClick={reset}>Try again</button></main>;
}
