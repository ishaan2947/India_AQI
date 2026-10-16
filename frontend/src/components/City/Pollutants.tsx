/**
 * What is actually in the air.
 *
 * The API has been returning PM10, O₃, NO₂, SO₂ and CO on every reading since
 * the first commit and the interface has only ever shown PM2.5. That is a
 * shame, because "AQI 240" tells you how bad it is and this tells you *what
 * it is* — and the two have different advice attached. A PM2.5 day is a mask
 * day; an ozone day is an afternoon-indoors day.
 *
 * Each pollutant is drawn against its own CPCB National Ambient Air Quality
 * Standard rather than in raw µg/m³, because 60 of PM2.5 and 60 of NO₂ are
 * not remotely the same news. Measured as a multiple of its own limit, the
 * bars are finally comparable, and the longest one is the thing doing the
 * damage today.
 */

import type { AQIReading } from "../../types";

interface Pollutant {
  key: keyof Pick<AQIReading, "pm25" | "pm10" | "o3" | "no2" | "so2" | "co">;
  label: string;
  unit: string;
  /** CPCB NAAQS limit, averaging period in `window`. */
  limit: number;
  window: string;
  note: string;
}

const POLLUTANTS: Pollutant[] = [
  {
    key: "pm25",
    label: "PM2.5",
    unit: "µg/m³",
    limit: 60,
    window: "24h",
    note: "Fine particles — the ones that reach the bloodstream.",
  },
  {
    key: "pm10",
    label: "PM10",
    unit: "µg/m³",
    limit: 100,
    window: "24h",
    note: "Coarse dust: construction, roads, crop burning.",
  },
  {
    key: "no2",
    label: "NO₂",
    unit: "µg/m³",
    limit: 80,
    window: "24h",
    note: "Traffic and diesel generators.",
  },
  {
    key: "so2",
    label: "SO₂",
    unit: "µg/m³",
    limit: 80,
    window: "24h",
    note: "Coal burning and heavy industry.",
  },
  {
    key: "o3",
    label: "O₃",
    unit: "µg/m³",
    limit: 100,
    window: "8h",
    note: "Ozone — cooked up by sunlight, peaks mid-afternoon.",
  },
  {
    key: "co",
    label: "CO",
    unit: "mg/m³",
    limit: 2,
    window: "8h",
    note: "Incomplete combustion; indoor sources matter most.",
  },
];

export default function Pollutants({ reading }: { reading: AQIReading | null }) {
  if (!reading) return null;

  const rows = POLLUTANTS.map((p) => ({
    ...p,
    value: reading[p.key],
  })).filter((p): p is Pollutant & { value: number } => typeof p.value === "number");

  if (rows.length === 0) return null;

  const scored = rows.map((r) => ({ ...r, ratio: r.value / r.limit }));
  const dominant = scored.reduce((a, b) => (b.ratio > a.ratio ? b : a));

  return (
    <section aria-labelledby="pollutants-heading">
      <h2 id="pollutants-heading" className="u-label">
        What&rsquo;s in the air
      </h2>

      <p className="u-prose mt-3">
        {dominant.ratio >= 1 ? (
          <>
            <span className="text-smoke-100">{dominant.label}</span> is doing
            the damage today, at{" "}
            <span className="text-smoke-100 tnum">
              {dominant.ratio.toFixed(1)}×
            </span>{" "}
            the CPCB {dominant.window} standard.
          </>
        ) : (
          <>
            Nothing is over its CPCB limit right now.{" "}
            <span className="text-smoke-100">{dominant.label}</span> is the
            closest, at{" "}
            <span className="text-smoke-100 tnum">
              {dominant.ratio.toFixed(1)}×
            </span>{" "}
            the {dominant.window} standard.
          </>
        )}
      </p>

      <dl className="mt-5 border-t border-smoke-800">
        {scored.map((p) => {
          // Two times the limit is full width, so the standard sits exactly
          // halfway across and "over the line" is literal.
          const width = Math.min(100, (p.ratio / 2) * 100);
          const over = p.ratio >= 1;
          return (
            <div
              key={p.key}
              className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3 border-b border-smoke-800 py-2.5"
              title={p.note}
            >
              <dt className="text-micro text-smoke-200">{p.label}</dt>
              <dd className="relative h-[7px] bg-smoke-850">
                <span
                  className="absolute inset-y-0 left-0 transition-[width] duration-move ease-air"
                  style={{
                    width: `${width}%`,
                    background: over ? "#F08B33" : "#9FC93C",
                  }}
                />
                {/* The limit itself, at the halfway mark. */}
                <span
                  aria-hidden
                  className="absolute inset-y-[-3px] left-1/2 w-px bg-smoke-500"
                />
              </dd>
              <dd className="text-right">
                <span className="u-figure block text-micro text-smoke-100">
                  {p.value >= 10 ? Math.round(p.value) : p.value.toFixed(2)}
                </span>
                <span className="block text-[10px] text-smoke-500">
                  {p.unit}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-3 text-micro leading-relaxed text-smoke-500">
        Bars run to twice the CPCB limit; the hairline is the limit itself.
        Averaging windows differ by pollutant (24h for particulates and
        oxides, 8h for ozone and CO), and these are instantaneous readings
        shown against them — indicative, not a compliance measurement.
      </p>
    </section>
  );
}
