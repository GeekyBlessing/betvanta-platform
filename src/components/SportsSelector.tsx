import Link from "next/link";
import type { SportCoverage, SportInfo } from "@/lib/services/sports";

/**
 * Sports selection: deep navy band, two columns of large white circles with each sport's illustration and its name in
 * bold white. Every card opens that sport's page (fixtures, results and predictions). The small line under the name is
 * counted from the database; a sport with no data feed says so instead of showing empty numbers.
 * Illustrations are BETVANTA originals (scripts/artwork/sport-illustrations.py), not league or brand marks.
 */
export function SportsSelector({ sports, coverage, id = "sports-h", title = "Choose your sport", intro }: {
  sports: SportInfo[]; coverage: Map<string, SportCoverage>; id?: string; title?: string; intro?: string;
}) {
  return (
    <section className="sports-select" aria-labelledby={id}>
      <div className="wrap py-12 md:py-20">
        <div className="text-center grid gap-2 mb-10 md:mb-16">
          <h2 id={id} className="display text-white font-extrabold text-[28px] leading-[34px] md:text-[40px] md:leading-[46px]">{title}</h2>
          {intro && <p className="text-white/70 text-[15px] md:text-[17px] max-w-[560px] mx-auto">{intro}</p>}
        </div>
        <ul className="sports-select-grid" role="list">
          {sports.map((s) => {
            const c = coverage.get(s.id);
            const parts = !c ? ["Coverage coming soon"]
              : [`${c.upcoming} ${c.upcoming === 1 ? "game" : "games"} this week`, ...(c.picks ? [`${c.picks} ${c.picks === 1 ? "pick" : "picks"}`] : [])];
            const meta = parts.join(" · ");
            return (
              <li key={s.id}>
                <Link href={`/sports/${s.slug}`} className="sport-card" aria-label={`${s.name}: ${meta}`}>
                  <span className="sport-circle">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local SVG, no optimisation needed */}
                    <img src={`/images/sports/${s.slug}.svg`} alt="" width={240} height={240} loading="lazy" decoding="async" />
                  </span>
                  <span className="sport-name">{s.name}</span>
                  <span className="sport-meta">{parts.map((t, i) => <span key={t} className={i ? "whitespace-nowrap" : undefined}>{i ? ` · ${t}` : t}</span>)}</span>
                </Link>
              </li>);
          })}
        </ul>
      </div>
    </section>
  );
}
