/** Original line icons for each sport (no league or brand marks). */
export function SportIcon({ sport, size = 40 }: { sport: string; size?: number }) {
  const s = { width: size, height: size, viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (sport) {
    case "american_football":
      return <svg {...s}><path d="M8 40C6 28 14 10 40 8c2 12-6 30-32 32z" /><path d="M14 34l20-20" /><path d="M20 24l4 4M23 21l4 4M26 18l4 4" /></svg>;
    case "basketball":
      return <svg {...s}><circle cx="24" cy="24" r="17" /><path d="M7 24h34M24 7v34" /><path d="M12 11c5 4 8 9 8 13s-3 9-8 13M36 11c-5 4-8 9-8 13s3 9 8 13" /></svg>;
    case "baseball":
      return <svg {...s}><circle cx="24" cy="24" r="17" /><path d="M14 10c4 4 6 9 6 14s-2 10-6 14M34 10c-4 4-6 9-6 14s2 10 6 14" /><path d="M15.5 15l3-1M17.5 20l3-.5M17.5 28l3 .5M15.5 33l3 1M32.5 15l-3-1M30.5 20l-3-.5M30.5 28l-3 .5M32.5 33l-3 1" /></svg>;
    default: // soccer
      return <svg {...s}><circle cx="24" cy="24" r="17" /><path d="M24 15l7 5-2.7 8h-8.6L17 20z" /><path d="M24 15V7.5M31 20l7.5-2.5M28.3 28l4.7 6.5M19.7 28L15 34.5M17 20l-7.5-2.5" /></svg>;
  }
}
