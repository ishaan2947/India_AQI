/**
 * The forecast page: tomorrow, hour by hour, for the whole country.
 *
 * What this replaced: an H1, a horizontal bar chart in a rounded card, and a
 * 4-across grid of thirty identical cards each holding one number and an
 * arrow. That layout had no opinion about what a forecast is for. A forecast
 * is about *when* — and the honest shape of this dataset is 30 cities × 24
 * hours, which is a grid, not thirty cards.
 *
 * So the page is: the single worst hour coming up anywhere in India, then the
 * grid, then who moves most. Each one is the same dataset asked a different
 * question.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import ForecastGrid, {
  buildRows,
  sortRows,
  type SortKey,
} from "../components/Forecast/ForecastGrid";
import Movers, { type Mover } from "../components/Forecast/Movers";
import { Reveal, RevealWords } from "../components/motion/Reveal";
import { useAccent } from "../hooks/useAccent";
import { useCurrentAQI } from "../hooks/useAQIData";
import { useAllPredictions } from "../hooks/usePredictions";
import {
  formatISTHourLabel,
  formatTimestamp,
  getAQIBand,
} from "../utils/aqiHelpers";

const SORTS: Array<[SortKey, string]> = [
  ["peak", "By peak"],
  ["now", "By now"],
  ["change", "By change"],
];

export default function Predictions() {
  const cities = useCurrentAQI();
  const preds = useAllPredictions();
  const [sort, setSort] = useState<SortKey>("peak");
  const navigate = useNavigate();

  const rows = useMemo(
    () => buildRows(preds.data, cities.data),
    [preds.data, cities.data],
  );
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  // /aqi/current is snapshot-seeded and lands immediately; the forecast
  // bundle is 720 recursive predictions and does not. The city names from the
  // former draw the grid's real shape while the latter is in flight.
  const pendingCities = useMemo(
    () =>
      (cities.data ?? [])
        .filter((c) => c.latest_aqi != null)
        .slice()
        .sort((a, b) => (b.latest_aqi ?? 0) - (a.latest_aqi ?? 0))
        .map((c) => c.name),
    [cities.data],
  );

  // The headline: the worst single hour anywhere in the next 24.
  const worstHour = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((a, b) => (b.peak > a.peak ? b : a));
  }, [rows]);

  const band = worstHour ? getAQIBand(worstHour.peak) : null;
  useAccent(band?.textColor ?? null, band?.color ?? null);

  const rising = rows.filter((r) => (r.change ?? 0) > 3).length;
  const falling = rows.filter((r) => (r.change ?? 0) < -3).length;

  const movers: Mover[] = useMemo(() => {
    const withChange = rows.filter((r) => r.change != null);
    const byChange = withChange
      .slice()
      .sort((a, b) => (b.change as number) - (a.change as number));
    // Five worsening most, five improving most — the two ends of the same
    // distribution, which is the only part of it that is news.
    //
    // Deduped, because with ten or fewer cities (a partially seeded database,
    // or most of the set missing readings) the two slices overlap and the
    // same city would be rendered twice under the same React key.
    const picked = new Map<number, (typeof byChange)[number]>();
    for (const r of [...byChange.slice(0, 5), ...byChange.slice(-5).reverse()]) {
      if (!picked.has(r.cityId)) picked.set(r.cityId, r);
    }
    return [...picked.values()].map((r) => ({
      cityId: r.cityId,
      city: r.city,
      now: r.now,
      then: r.cells[r.cells.length - 1].aqi,
      change: r.change as number,
    }));
  }, [rows]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-data px-gutter py-10 sm:px-6 lg:px-gutter-lg lg:py-14">
        {/* ---- The answer first ---- */}
        <header>
          <p className="u-label text-smoke-500">Next 24 hours · forecast</p>
          {worstHour && band ? (
            <>
              <h1 className="mt-3 max-w-[20ch] font-serif text-display font-normal leading-[1.06] text-smoke-100">
                <RevealWords
                  text={`${worstHour.city} peaks at ${Math.round(
                    worstHour.peak,
                  )} around ${formatISTHourLabel(worstHour.peakAt)}.`}
                />
              </h1>
              <Reveal delay={90}>
                <p className="u-prose mt-5 max-w-prose">
                  That is{" "}
                  <span style={{ color: band.textColor }}>
                    {band.label.toLowerCase()}
                  </span>{" "}
                  air — {band.verdict.toLowerCase()}. Across the thirty cities,{" "}
                  <span className="text-smoke-100 tnum">{rising}</span> get
                  worse over the next day and{" "}
                  <span className="text-smoke-100 tnum">{falling}</span> get
                  better.
                </p>
                <p className="mt-3 text-micro text-smoke-500">
                  Random forest, 120 trees, retrained every 24 hours · model
                  run {formatTimestamp(preds.data?.generated_at)} · hours shown
                  in IST
                </p>
              </Reveal>
            </>
          ) : (
            <h1 className="mt-3 max-w-[20ch] font-serif text-display font-normal leading-[1.06] text-smoke-100">
              {preds.error ? "The forecast is unavailable." : "Running the model…"}
            </h1>
          )}
        </header>

        {/* ---- The grid ---- */}
        <section className="mt-12 lg:mt-16" aria-labelledby="grid-heading">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-smoke-700 pb-3">
            <div>
              <h2 id="grid-heading" className="text-head text-smoke-100">
                Every city, every hour
              </h2>
              <p className="mt-1 text-micro text-smoke-500">
                One cell per hour, coloured by CPCB band. Midnight is the
                hairline.
              </p>
            </div>
            <div className="flex items-baseline gap-5">
              {SORTS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={sort === key}
                  onClick={() => setSort(key)}
                  className={`u-label border-b pb-1 transition-colors duration-tap ease-air ${
                    sort === key
                      ? "border-[color:var(--accent)] text-smoke-100"
                      : "border-transparent text-smoke-500 hover:text-smoke-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <ForecastGrid
              rows={sorted}
              pendingCities={pendingCities}
              loading={preds.loading}
              error={preds.error}
            />
          </div>
        </section>

        {/* ---- Movers + the model's own caveat ---- */}
        <section className="mt-14 grid gap-12 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-20">
          <div>
            <h2 className="text-head text-smoke-100">
              Biggest movers, next 24 hours
            </h2>
            <p className="mt-1 text-micro text-smoke-500">
              Change between now and this time tomorrow. Bar colour is the band
              the city lands in.
            </p>
            <Movers movers={movers} onPick={(id) => navigate(`/cities/${id}`)} />
          </div>

          <div className="lg:pt-10">
            <h2 className="u-label">How much to trust this</h2>
            <p className="u-prose mt-3">
              The 24-hour horizon is produced recursively — each prediction is
              fed back in as a lag feature for the next one — so error
              compounds with distance. Hour 23 is a guess built on twenty-two
              earlier guesses, and nothing in the model knows that a festival,
              a weather front or a stubble fire is coming.
            </p>
            <p className="u-prose mt-4">
              Treat the shape as the signal and the exact figure as the
              noise: the model is reliable about <em>when</em> a peak arrives
              and rough about how high it goes. Each city&rsquo;s own page
              draws the spread across the 120 trees around its line — where
              they disagree, trust the number less.
            </p>
            <Link
              to="/how-it-works"
              className="group mt-5 inline-flex items-baseline gap-2 text-body font-semibold text-smoke-100 transition-colors duration-tap ease-air hover:text-white"
            >
              What the model actually does
              <span
                aria-hidden
                className="text-[color:var(--accent)] transition-transform duration-move ease-air group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
