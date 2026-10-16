/**
 * Who gets worse, and who gets better, over the next twenty-four hours.
 *
 * The old page expressed this as a tiny arrow in the corner of each card —
 * ↑ 14 — which is readable one city at a time and meaningless across thirty.
 * As a diverging list against a centre line it is one glance: the length of
 * the bar is the size of the change, the side it falls on is the direction,
 * and the colour is the band the city *lands in*, not the direction of travel,
 * so a city improving from severe to very poor still reads as bad news.
 */

import { getAQIBand } from "../../utils/aqiHelpers";

export interface Mover {
  cityId: number;
  city: string;
  now: number | null;
  then: number;
  change: number;
}

export default function Movers({
  movers,
  onPick,
}: {
  movers: Mover[];
  onPick: (cityId: number) => void;
}) {
  if (movers.length === 0) return null;

  const widest = Math.max(...movers.map((m) => Math.abs(m.change)), 1);

  return (
    <ol className="mt-4 border-t border-smoke-800">
      {movers.map((m) => {
        const band = getAQIBand(m.then);
        const pct = (Math.abs(m.change) / widest) * 50; // half-width each side
        const rising = m.change >= 0;
        return (
          <li key={m.cityId} className="border-b border-smoke-800">
            <button
              type="button"
              onClick={() => onPick(m.cityId)}
              className="group flex w-full items-center gap-3 py-2 text-left transition-colors duration-tap ease-air hover:bg-smoke-900"
            >
              <span className="w-20 shrink-0 truncate text-micro text-smoke-200 group-hover:text-smoke-100 sm:w-24">
                {m.city}
              </span>

              {/* The centre line is "no change". Everything right of it is
                  getting worse tonight. */}
              <span className="relative h-3 flex-1 border-l border-smoke-700">
                <span
                  className="absolute top-1/2 h-[5px] -translate-y-1/2"
                  style={{
                    background: band.color,
                    width: `${pct}%`,
                    left: rising ? "50%" : undefined,
                    right: rising ? undefined : "50%",
                  }}
                />
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-1/2 w-px bg-smoke-600"
                />
              </span>

              <span
                className="u-figure w-10 shrink-0 text-right text-micro"
                style={{ color: rising ? "#F4705D" : "#7FD177" }}
              >
                {rising ? "+" : "−"}
                {Math.abs(Math.round(m.change))}
              </span>
              <span
                className="u-figure w-9 shrink-0 text-right text-micro"
                style={{ color: band.textColor }}
              >
                {Math.round(m.then)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
