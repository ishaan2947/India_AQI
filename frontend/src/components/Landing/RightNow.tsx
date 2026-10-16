/**
 * Thirty cities as a ranked table, which is what the three stat cards should
 * have been all along.
 *
 * The whole dataset, in one glance, ordered. Each row carries its own bar in
 * a track notched at the CPCB thresholds (50 / 100 / 200 / 300), so a bar's
 * length is readable as a band and not just as "longer than that one". The
 * value sits at the right edge in tabular figures, and the row itself is the
 * link — a 44px-high target on a phone, rather than a `view city →` micro-CTA
 * to aim at.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useCurrentAQI } from "../../hooks/useAQIData";
import type { CityWithLatest } from "../../types";
import {
  formatISTClock,
  formatTimestamp,
  getAQIBand,
  getAllCategories,
} from "../../utils/aqiHelpers";
import { Reveal, RevealWords, useReveal } from "../motion/Reveal";

/** Bars are scaled against the top of CPCB's "very poor" band. */
const SCALE_MAX = 400;
const TICKS = [50, 100, 200, 300];

type Order = "worst" | "cleanest";

export default function RightNow() {
  const { data: cities, loading, error } = useCurrentAQI();
  const [order, setOrder] = useState<Order>("worst");
  const list = useReveal<HTMLOListElement>();

  const rows = useMemo(() => {
    const withReadings = (cities ?? []).filter((c) => c.latest_aqi != null);
    return withReadings
      .slice()
      .sort((a, b) =>
        order === "worst"
          ? (b.latest_aqi ?? 0) - (a.latest_aqi ?? 0)
          : (a.latest_aqi ?? 0) - (b.latest_aqi ?? 0),
      );
  }, [cities, order]);

  const latest = useMemo(
    () =>
      (cities ?? []).reduce<string | null>((acc, c) => {
        if (!c.latest_timestamp) return acc;
        return !acc || c.latest_timestamp > acc ? c.latest_timestamp : acc;
      }, null),
    [cities],
  );

  const above200 = rows.filter((c) => (c.latest_aqi ?? 0) > 200).length;

  return (
    <section
      id="right-now"
      className="scroll-mt-16 border-t border-smoke-700 bg-smoke-950"
      aria-labelledby="right-now-heading"
    >
      <div className="mx-auto max-w-data px-gutter py-band sm:px-6 lg:px-gutter-lg lg:py-band-lg">
        <div className="grid gap-10 lg:grid-cols-[19rem_1fr] lg:gap-16">
          {/* The heading rail. Sticky on desktop, so the scale legend stays
              beside the rows it explains instead of scrolling off. */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <h2 id="right-now-heading" className="text-display text-smoke-100">
              <RevealWords text="Thirty cities," />
              <br />
              <RevealWords text="worst first" delay={120} />
            </h2>

            <Reveal className="mt-5" delay={80}>
              <p className="u-prose max-w-prose">
                Every city this site monitors, ranked by its most recent
                reading.{" "}
                {rows.length > 0 ? (
                  <>
                    <span className="text-smoke-100 tnum">{above200}</span> of{" "}
                    <span className="text-smoke-100 tnum">{rows.length}</span>{" "}
                    are above 200 right now — the line where CPCB stops saying
                    “moderate” and starts saying “poor”.
                  </>
                ) : null}
              </p>

              <p className="mt-4 text-micro text-smoke-500">
                {latest ? (
                  <>
                    Latest reading {formatISTClock(latest) ?? "—"} · updated{" "}
                    {formatTimestamp(latest)}
                  </>
                ) : (
                  "Waiting on the first reading."
                )}
              </p>

              <OrderToggle order={order} onChange={setOrder} />
              <ScaleLegend />
            </Reveal>
          </div>

          {/* The table. */}
          <div className="min-w-0">
            {rows.length === 0 ? (
              <TablePlaceholder loading={loading} error={error} />
            ) : (
              <ol
                ref={list.ref}
                className="border-t border-smoke-800"
                aria-label={
                  order === "worst"
                    ? "Cities ranked worst air first"
                    : "Cities ranked cleanest air first"
                }
              >
                {rows.map((city, i) => (
                  <Row
                    key={city.id}
                    rank={i + 1}
                    city={city}
                    grown={list.shown}
                    delay={Math.min(i, 14) * 26}
                  />
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  rank,
  city,
  grown,
  delay,
}: {
  rank: number;
  city: CityWithLatest;
  grown: boolean;
  delay: number;
}) {
  const aqi = city.latest_aqi ?? 0;
  const band = getAQIBand(aqi);
  const fraction = Math.min(1, Math.max(0.01, aqi / SCALE_MAX));

  return (
    <li className="border-b border-smoke-800">
      <Link
        to={`/cities/${city.id}`}
        className="group relative grid grid-cols-[1.5rem_1fr_3.2rem] items-baseline gap-x-3 py-3 transition-colors duration-tap ease-air hover:bg-smoke-900 sm:grid-cols-[2rem_12.5rem_1fr_3.4rem_7.5rem] sm:gap-x-5 sm:py-3.5"
      >
        <span className="u-figure text-micro font-semibold text-smoke-500 tabular-nums">
          {rank}
        </span>

        <span className="min-w-0">
          <span className="block truncate text-row font-semibold text-smoke-100 transition-colors duration-tap ease-air group-hover:text-white">
            {city.name}
          </span>
          <span className="mt-0.5 block truncate text-micro text-smoke-500">
            {city.state}
          </span>
        </span>

        {/* Out of grid flow on a phone: the bar becomes the row's own bottom
            rule, which keeps three columns legible at 375px without losing
            the comparison the bar exists to make. */}
        <span className="absolute inset-x-0 bottom-0 sm:relative sm:inset-auto sm:self-center">
          <Bar fraction={fraction} color={band.color} grown={grown} delay={delay} />
        </span>

        <span
          className="u-figure text-row text-right"
          style={{ color: band.textColor }}
        >
          {Math.round(aqi)}
        </span>

        <span className="hidden text-right text-micro text-smoke-300 sm:block">
          {band.label}
        </span>
      </Link>
    </li>
  );
}

/**
 * The bar grows from nothing on first intersection, because the growth *is*
 * the value — and it grows with `transform` rather than `width` so thirty of
 * them animating at once costs no layout.
 */
function Bar({
  fraction,
  color,
  grown,
  delay,
}: {
  fraction: number;
  color: string;
  grown: boolean;
  delay: number;
}) {
  return (
    <span className="relative block h-[3px] w-full overflow-hidden bg-smoke-800 sm:h-[7px]">
      <span
        className="absolute inset-0 origin-left transition-transform duration-enter ease-air"
        style={{
          background: color,
          transform: `scaleX(${grown ? fraction : 0})`,
          transitionDelay: `${delay}ms`,
        }}
      />
      {/* CPCB thresholds, notched into the bar so its length reads as a band. */}
      {TICKS.map((t) => (
        <span
          key={t}
          className="absolute top-0 h-full w-px bg-smoke-950/70"
          style={{ left: `${(t / SCALE_MAX) * 100}%` }}
        />
      ))}
    </span>
  );
}

function OrderToggle({
  order,
  onChange,
}: {
  order: Order;
  onChange: (o: Order) => void;
}) {
  const options: Array<[Order, string]> = [
    ["worst", "Worst first"],
    ["cleanest", "Cleanest first"],
  ];
  return (
    <div className="mt-8 flex items-baseline gap-5">
      {options.map(([value, label]) => {
        const active = order === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={`u-label border-b pb-1 transition-colors duration-tap ease-air ${
              active
                ? "border-[color:var(--accent)] text-smoke-100"
                : "border-transparent text-smoke-500 hover:text-smoke-200"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The scale, as a continuous strip rather than six chips — it is one
 * dimension, so it reads as one object. Doubles as the key for the notches in
 * every bar above.
 */
export function ScaleLegend({ withNote = true }: { withNote?: boolean } = {}) {
  const bands = getAllCategories();
  return (
    <div className="mt-8">
      <p className="u-label">CPCB scale</p>
      <div className="mt-2 flex h-2 w-full overflow-hidden">
        {bands.map((b) => (
          <span
            key={b.key}
            className="h-full"
            style={{
              background: b.color,
              // Weighted by the band's actual width, capped at the top so
              // "severe" doesn't run off to infinity.
              flexGrow: Math.min(b.max, 500) - b.min + 1,
            }}
            title={`${b.label} ${b.min}–${Math.min(b.max, 500)}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-smoke-500 tnum">
        <span>0</span>
        <span>100</span>
        <span>200</span>
        <span>300</span>
        <span>400</span>
        <span>500</span>
      </div>
      {withNote ? (
        <p className="mt-3 text-micro leading-relaxed text-smoke-500">
          Good · Satisfactory · Moderate · Poor · Very poor · Severe. Readings
          come from WAQI on the US EPA index and are shown against CPCB band
          names —{" "}
          <Link
            to="/how-it-works"
            className="underline decoration-smoke-700 underline-offset-2 transition-colors duration-tap ease-air hover:text-smoke-200"
          >
            why that is
          </Link>
          .
        </p>
      ) : (
        <p className="mt-3 text-micro leading-relaxed text-smoke-500">
          Good · Satisfactory · Moderate · Poor · Very poor · Severe.
        </p>
      )}
    </div>
  );
}

/** Skeleton rows at the real row height, so nothing shifts when data lands. */
function TablePlaceholder({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="border-t border-smoke-800 py-10">
        <p className="font-serif text-lead text-smoke-100">
          The rankings are unavailable.
        </p>
        <p className="u-prose mt-2 max-w-prose">{error}</p>
      </div>
    );
  }

  return (
    <div className="border-t border-smoke-800" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1.5rem_1fr_3.2rem] items-center gap-x-3 border-b border-smoke-800 py-3 sm:grid-cols-[2rem_12.5rem_1fr_3.4rem_7.5rem] sm:gap-x-5 sm:py-3.5"
        >
          <span className="skeleton h-3 w-3" />
          <span className="skeleton h-4 w-28" />
          <span className="skeleton hidden h-[7px] w-full sm:block" />
          <span className="skeleton h-4 w-full" />
          <span className="skeleton hidden h-3 w-16 sm:block" />
        </div>
      ))}
      <p className="pt-5 font-serif text-body text-smoke-300">
        {loading
          ? "Waking the backend — about thirty seconds from cold."
          : "No readings yet."}
      </p>
    </div>
  );
}
