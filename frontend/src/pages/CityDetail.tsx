/**
 * One city, in full.
 *
 * The old page was four cards: an advice banner, a summary card, a history
 * chart, a forecast chart. Four boxes, four borders, four headings, and the
 * reader assembling the story themselves.
 *
 * The order here is the same argument the front page makes — the reading,
 * then where it sits against the other twenty-nine, then the shape of the
 * day, then what the air is actually made of, then what the model expects.
 * One column of evidence rather than a grid of containers.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import CityTimeline from "../components/City/CityTimeline";
import Pollutants from "../components/City/Pollutants";
import { useArrive, useSettle } from "../components/motion/Arrive";
import { Reveal } from "../components/motion/Reveal";
import { fetchCity, fetchCityHistory } from "../api/client";
import { citySnapshot } from "../data/snapshot";
import { useAccent } from "../hooks/useAccent";
import { useCurrentAQI } from "../hooks/useAQIData";
import { useCityPrediction } from "../hooks/usePredictions";
import type { AQIReading, CityWithLatest } from "../types";
import {
  formatISTClock,
  formatISTHourLabel,
  formatTimestamp,
  getAQIAdvice,
  getAQIBand,
} from "../utils/aqiHelpers";

export default function CityDetail() {
  const { cityId } = useParams<{ cityId: string }>();
  const id = cityId ? Number(cityId) : null;

  const [fetchedCity, setFetchedCity] = useState<CityWithLatest | null>(null);
  const [latestReading, setLatestReading] = useState<AQIReading | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all = useCurrentAQI();
  const prediction = useCityPrediction(id);

  // A freshness ladder rather than a single source, so the masthead is
  // populated on the first frame and only ever gets more current:
  //
  //   1. /cities/:id        — the authoritative record, once it lands
  //   2. /aqi/current       — already on screen, polls every 5 min, and is
  //                           itself seeded from the bundled snapshot
  //   3. the bundled snapshot — the floor, for an id the list doesn't carry
  //
  // Every rung carries its own `latest_timestamp`, which the page prints
  // under "Reading for" and "Updated", so a visitor is never shown an old
  // number without being told how old it is.
  const city = useMemo(
    () =>
      fetchedCity ??
      all.data?.find((c) => c.id === id) ??
      citySnapshot(id),
    [fetchedCity, all.data, id],
  );

  useEffect(() => {
    if (id == null) return;
    let cancelled = false;
    setFetchedCity(null);
    setLatestReading(null);
    setError(null);
    (async () => {
      try {
        const [c, hist] = await Promise.all([
          fetchCity(id),
          // The newest history row carries the full pollutant breakdown, so
          // this doubles as the /latest call the page would otherwise make.
          fetchCityHistory(id, 24),
        ]);
        if (cancelled) return;
        setFetchedCity(c);
        setLatestReading(hist.length > 0 ? hist[hist.length - 1] : null);
      } catch (err) {
        if (cancelled) return;
        // A failed refresh on top of a populated page is not a page-level
        // error — the visitor is reading a real, timestamped number from a
        // lower rung of the ladder. Only admit failure when every rung is
        // empty, which in practice means an id that doesn't exist.
        const haveSomething =
          all.data?.some((c) => c.id === id) || citySnapshot(id) != null;
        if (!haveSomething) {
          setError(err instanceof Error ? err.message : "Failed to load city");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const aqi = city?.latest_aqi ?? null;
  const band = aqi != null ? getAQIBand(aqi) : null;
  useAccent(band?.textColor ?? null, band?.color ?? null);

  // Where this city sits among the thirty — the single most useful piece of
  // context a number like 231 can be given, and it costs one sort.
  const rank = useMemo(() => {
    if (!all.data || aqi == null || !city) return null;
    const withReadings = all.data.filter((c) => c.latest_aqi != null);
    const sorted = withReadings
      .slice()
      .sort((a, b) => (b.latest_aqi ?? 0) - (a.latest_aqi ?? 0));
    const index = sorted.findIndex((c) => c.id === city.id);
    return index < 0 ? null : { place: index + 1, of: sorted.length };
  }, [all.data, aqi, city]);

  const forecast = useMemo(() => {
    const points = prediction.data?.points ?? [];
    if (points.length === 0) return null;
    const peak = points.reduce((a, b) =>
      b.predicted_aqi > a.predicted_aqi ? b : a,
    );
    const trough = points.reduce((a, b) =>
      b.predicted_aqi < a.predicted_aqi ? b : a,
    );
    const end = points[points.length - 1];
    return {
      peak,
      trough,
      end,
      change: aqi != null ? end.predicted_aqi - aqi : null,
      meanConfidence:
        points.reduce((acc, p) => acc + p.confidence_score, 0) / points.length,
    };
  }, [prediction.data, aqi]);

  // The masthead is painted from the snapshot on the first frame, so it
  // arrives as a short staggered gesture rather than appearing all at once.
  // Reading order, not visual weight: where you are, then what it is called,
  // then the number, then what to do about it, then the provenance.
  const arriveState = useArrive(0);
  const arriveName = useArrive(40);
  const arriveNumber = useArrive(90);
  const arriveAdvice = useArrive(140);
  const arriveFacts = useArrive(190);

  // Keyed on the rounded figure, which is what is actually on screen: the
  // ladder's three rungs normally agree to the integer, so a refresh that
  // confirms the snapshot stays perfectly still.
  const settleAqi = useSettle(aqi == null ? null : Math.round(aqi));

  if (id == null) {
    return (
      <div className="p-6 font-serif text-body text-smoke-300">
        Invalid city id.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-data px-gutter py-8 sm:px-6 lg:px-gutter-lg lg:py-12">
        <Link
          to="/map"
          className="group inline-flex items-baseline gap-2 text-micro text-smoke-500 transition-colors duration-tap ease-air hover:text-smoke-200"
        >
          <span
            aria-hidden
            className="transition-transform duration-move ease-air group-hover:-translate-x-1"
          >
            ←
          </span>
          Back to the map
        </Link>

        {error ? (
          <div className="mt-10">
            <h1 className="font-serif text-display font-normal text-smoke-100">
              That city didn&rsquo;t load.
            </h1>
            <p className="u-prose mt-4 max-w-prose">{error}</p>
            <Link
              to="/"
              className="mt-6 inline-block text-body font-semibold text-smoke-100 underline decoration-smoke-600 underline-offset-4"
            >
              Back to today&rsquo;s air
            </Link>
          </div>
        ) : !city ? (
          <Skeleton />
        ) : (
          <>
            {/* ---- The reading ---- */}
            <header className="mt-6">
              <p
                style={arriveState.style}
                className={`${arriveState.className} u-label text-smoke-500`}
              >
                {city.state}
              </p>
              <h1
                style={arriveName.style}
                className={`${arriveName.className} mt-1 text-display text-smoke-100`}
              >
                {city.name}
              </h1>

              {aqi != null && band ? (
                <>
                  <div
                    style={arriveNumber.style}
                    className={`${arriveNumber.className} mt-6 flex flex-wrap items-end gap-x-6 gap-y-2 border-t border-smoke-700 pt-6`}
                  >
                    <span
                      className={`u-figure text-[clamp(4rem,11vw,8rem)] leading-[0.82] ${settleAqi}`}
                      style={{ color: band.textColor }}
                    >
                      {Math.round(aqi)}
                    </span>
                    <span className="mb-1">
                      <span className="block font-serif text-lead text-smoke-100">
                        {band.verdict}
                      </span>
                      <span
                        className="mt-1 block u-label"
                        style={{ color: band.textColor }}
                      >
                        AQI · {band.label}
                        {rank ? ` · ${ordinal(rank.place)} worst of ${rank.of}` : ""}
                      </span>
                    </span>
                  </div>

                  <p
                    style={arriveAdvice.style}
                    className={`${arriveAdvice.className} u-prose mt-5 max-w-prose`}
                  >
                    {getAQIAdvice(aqi)}
                  </p>

                  <dl
                    style={arriveFacts.style}
                    className={`${arriveFacts.className} mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-micro text-smoke-300 tnum`}
                  >
                    <Fact label="Reading for">
                      {formatISTClock(city.latest_timestamp) ?? "unknown hour"}
                    </Fact>
                    <Fact label="Updated">
                      {formatTimestamp(city.latest_timestamp)}
                    </Fact>
                    <Fact label="Source">
                      {city.latest_source?.toLowerCase() === "synthetic"
                        ? "Synthetic fallback"
                        : "WAQI"}
                    </Fact>
                    <Fact label="Station">
                      {city.lat.toFixed(2)}°N {city.lng.toFixed(2)}°E
                    </Fact>
                  </dl>
                </>
              ) : (
                <p className="u-prose mt-6">
                  No reading has arrived for {city.name} yet.
                </p>
              )}
            </header>

            {/* ---- The shape of the day ---- */}
            <div className="mt-12 lg:mt-16">
              <CityTimeline cityId={city.id} cityName={city.name} />
            </div>

            {/* ---- Composition + what the model expects ---- */}
            <Reveal className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,28rem)_1fr] lg:gap-20">
              <Pollutants reading={latestReading} />

              <div>
                <h2 className="u-label">Next 24 hours</h2>
                {forecast ? (
                  <>
                    <p className="u-prose mt-3">
                      The model expects a peak of{" "}
                      <span
                        className="tnum"
                        style={{
                          color: getAQIBand(forecast.peak.predicted_aqi)
                            .textColor,
                        }}
                      >
                        {Math.round(forecast.peak.predicted_aqi)}
                      </span>{" "}
                      around{" "}
                      {formatISTHourLabel(forecast.peak.prediction_for)} IST and
                      a low of{" "}
                      <span className="tnum text-smoke-100">
                        {Math.round(forecast.trough.predicted_aqi)}
                      </span>{" "}
                      around{" "}
                      {formatISTHourLabel(forecast.trough.prediction_for)}.
                      {forecast.change != null ? (
                        <>
                          {" "}
                          By this time tomorrow it has the air{" "}
                          {forecast.change >= 0 ? "worse" : "better"} by{" "}
                          <span className="tnum text-smoke-100">
                            {Math.abs(Math.round(forecast.change))}
                          </span>
                          .
                        </>
                      ) : null}
                    </p>
                    <dl className="mt-5 border-t border-smoke-800">
                      <SummaryRow
                        label="Peak"
                        value={`${Math.round(forecast.peak.predicted_aqi)} at ${formatISTHourLabel(
                          forecast.peak.prediction_for,
                        )} IST`}
                      />
                      <SummaryRow
                        label="Low"
                        value={`${Math.round(forecast.trough.predicted_aqi)} at ${formatISTHourLabel(
                          forecast.trough.prediction_for,
                        )} IST`}
                      />
                      <SummaryRow
                        label="Tree agreement"
                        value={`${Math.round(forecast.meanConfidence * 100)}% mean`}
                      />
                      <SummaryRow
                        label="Model run"
                        value={formatTimestamp(prediction.data?.generated_at)}
                      />
                    </dl>
                  </>
                ) : prediction.error ? (
                  <p className="u-prose mt-3">
                    The forecast didn&rsquo;t load — {prediction.error}
                  </p>
                ) : (
                  <p className="u-prose mt-3">Running the model…</p>
                )}

                <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
                  <PageLink to="/predictions">All thirty forecasts</PageLink>
                  <PageLink to="/">Today&rsquo;s ranking</PageLink>
                </div>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="u-label text-smoke-500">{label}</dt>
      <dd className="text-smoke-200">{children}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-smoke-800 py-2.5">
      <dt className="text-micro text-smoke-500">{label}</dt>
      <dd className="text-right text-body text-smoke-100 tnum">{value}</dd>
    </div>
  );
}

function PageLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-baseline gap-2 text-body font-semibold text-smoke-100 transition-colors duration-tap ease-air hover:text-white"
    >
      {children}
      <span
        aria-hidden
        className="text-[color:var(--accent)] transition-transform duration-move ease-air group-hover:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}

/** Matches the real layout's geometry, so nothing jumps when data lands. */
function Skeleton() {
  return (
    <div className="mt-6" aria-hidden>
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-3 h-12 w-64" />
      <div className="mt-6 flex items-end gap-6 border-t border-smoke-700 pt-6">
        <div className="skeleton h-24 w-40" />
        <div className="space-y-2">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-3 w-44" />
        </div>
      </div>
      <div className="skeleton mt-12 h-[320px] w-full" />
    </div>
  );
}
