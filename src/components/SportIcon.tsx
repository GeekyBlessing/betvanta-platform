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
    case "ice_hockey":
      return <svg {...s}><path d="M34 6L18 34c-1 2-3 3-5 3H7" /><path d="M14 6l16 28c1 2 3 3 5 3h6" /><ellipse cx="24" cy="39" rx="7" ry="2.5" /><path d="M17 39v2.5c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5V39" /></svg>;
    case "tennis":
      return <svg {...s}><ellipse cx="20" cy="18" rx="11" ry="13" transform="rotate(-35 20 18)" /><path d="M27.5 28.5L40 43" /><path d="M13 13l13 9M15 24l9-12" /><circle cx="37" cy="12" r="5" /></svg>;
    case "boxing":
      return <svg {...s}><path d="M15 30c-3-5-3-16 6-20 9-4 17 1 17 10 0 6-3 10-6 12v4H17c0-3-1-4-2-6z" /><path d="M15 30c-3-1-5 1-4 4 1 3 5 4 8 2" /><path d="M17 36h15v6H17z" /><path d="M21 21c4-1 9-1 13 1" /></svg>;
    case "mma":
      return <svg {...s}><rect x="11" y="8" width="26" height="14" rx="6" /><path d="M14 22v6M20 22v6M26 22v6M32 22v6" /><path d="M12 26h24v14a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3z" /><path d="M12 33h24" /></svg>;
    default: // soccer
      return <svg {...s}><circle cx="24" cy="24" r="17" /><path d="M24 15l7 5-2.7 8h-8.6L17 20z" /><path d="M24 15V7.5M31 20l7.5-2.5M28.3 28l4.7 6.5M19.7 28L15 34.5M17 20l-7.5-2.5" /></svg>;
  }
}
