/**
 * The hero: a live reading, printed over the air it describes.
 *
 * The old hero was an eyebrow, a headline, a subtitle and two buttons — the
 * standard kit, and it said nothing a reader couldn't have guessed from the
 * domain name. This one opens with the answer: a city, a three-digit number
 * at 15rem, and two words telling you what to do about it.
 *
 * The photograph is the second half of the same sentence. Its subject sits at
 * 27.1767°N, 78.0081°E — Agra, a city this site monitors — so the frame can be
 * *graded by its own reading*: clean air means crisp marble, and as the number
 * climbs a brown-grey scatter layer settles over it, contrast dies and the
 * building recedes. Scrolling thickens it to today's real level (see
 * hooks/useHaze.ts for the mechanics).
 *
 * Art direction inherited from the previous design, because it was sampled off
 * the file rather than eyeballed and it still holds: the top quarter of the
 * frame is bright empty sky (luma ~170–210, hopeless for white type) and the
 * bottom third is dark garden (luma ~50–80). So type lives at the bottom, the
 * crop sits low (object-position 58%) to ride the building high in the band,
 * and the base dissolves into the page ground.
 */

import { useMemo, useRef, useState } from "react";

import { useAccent } from "../../hooks/useAccent";
import { imageForCity } from "../../data/cityImages";
import CityPhoto from "./CityPhoto";
import CitySwitcher from "./CitySwitcher";
import { useCurrentAQI } from "../../hooks/useAQIData";
import { useHaze } from "../../hooks/useHaze";
import type { CityWithLatest } from "../../types";
import {
  formatISTClock,
  formatTimestamp,
  getAQIBand,
  getHazeDensity,
} from "../../utils/aqiHelpers";

/** The city in the photograph. */
const PICTURED = "agra";

// Stops chosen against the sampled luma curve. The top of the frame is pale
// sky meeting a near-black page — left alone that seam is a hard bright line
// across the screen, so the scrim starts opaque and falls off fast (the dome
// is only ~10% down the band and a slower fade would veil the building in
// exactly the place we want it seen). The bottom runs much heavier: the
// reading sits on it and needs a dark bed at AA contrast even when the haze
// has lifted the whole frame.
const TOP_SCRIM =
  "linear-gradient(to bottom, rgba(12,11,10,0.85) 0%, rgba(12,11,10,0.3) 4%, rgba(12,11,10,0.08) 10%, rgba(12,11,10,0) 20%)";
const BOTTOM_SCRIM =
  "linear-gradient(to top, #0C0B0A 0%, rgba(12,11,10,0.97) 18%, rgba(12,11,10,0.78) 34%, rgba(12,11,10,0.3) 56%, rgba(12,11,10,0) 76%)";

/**
 * The backend stores a source key, not a name. "synthetic" is the fallback
 * series generated when WAQI is unreachable, and saying so plainly is the
 * whole point — see DESIGN.md principle 5.
 */
function sourceLabel(source: string | null | undefined): string {
  if (!source) return "WAQI";
  if (source.toLowerCase() === "synthetic") return "Synthetic fallback";
  if (source.toLowerCase() === "waqi") return "WAQI";
  return source;
}

function pickDefaultCity(cities: CityWithLatest[] | null): CityWithLatest | null {
  if (!cities || cities.length === 0) return null;
  const withReadings = cities.filter((c) => c.latest_aqi != null);
  if (withReadings.length === 0) return null;

  // The city in the frame first, then the one everyone means when they say
  // "Indian air quality", then whichever is worst right now — so the hero is
  // never empty and never arbitrary.
  return (
    withReadings.find((c) => c.name.toLowerCase() === PICTURED) ??
    withReadings.find((c) => c.name.toLowerCase() === "delhi") ??
    withReadings.reduce((a, b) =>
      (b.latest_aqi ?? 0) > (a.latest_aqi ?? 0) ? b : a,
    )
  );
}

export default function Hero() {
  const { data: cities, loading, error } = useCurrentAQI();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const bandRef = useRef<HTMLDivElement>(null);

  const city = useMemo(() => {
    const fallback = pickDefaultCity(cities);
    if (selectedId == null) return fallback;
    return cities?.find((c) => c.id === selectedId) ?? fallback;
  }, [cities, selectedId]);

  const aqi = city?.latest_aqi ?? null;
  const band = aqi != null ? getAQIBand(aqi) : null;

  useHaze(bandRef, getHazeDensity(aqi));
  // 420ms: far enough into the 900ms dissolve that the document-wide style
  // recalculation isn't competing with the fade's frames.
  useAccent(band?.textColor ?? null, band?.color ?? null, band?.inkColor ?? null, 420);

  const sorted = useMemo(
    () =>
      (cities ?? [])
        .filter((c) => c.latest_aqi != null)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [cities],
  );

  const photo = imageForCity(city?.name);
  const istClock = formatISTClock(city?.latest_timestamp);

  return (
    <section className="relative" aria-labelledby="hero-reading">
      <div
        ref={bandRef}
        // isolate: the scatter layer screen-blends, and without a stacking
        // context of its own it would blend against the page ground too.
        className="relative isolate h-[74dvh] min-h-[480px] w-full overflow-hidden sm:h-[80dvh] lg:h-[86dvh] lg:max-h-[900px]"
      >
        <CityPhoto
          image={photo}
          alt={
            aqi != null && city
              ? `${photo.title} — shown through haze matching an AQI of ${Math.round(
                  aqi,
                )} in ${city.name}`
              : photo.title
          }
        />

        {/* The air itself. Order matters: haze over the photograph, scrims
            over the haze, so the frame can wash out without taking the
            legibility of the reading with it. */}
        <div aria-hidden className="haze-scatter absolute inset-0" />
        <div aria-hidden className="haze-ground absolute inset-0" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: TOP_SCRIM }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: BOTTOM_SCRIM }}
        />

        <HazeMeter aqi={aqi} />

        <div className="absolute inset-x-0 bottom-0 px-gutter pb-7 sm:px-6 sm:pb-9 lg:px-gutter-lg lg:pb-12">
          <div className="mx-auto max-w-data">
            {city && aqi != null && band ? (
              <Reading
                city={city}
                aqi={aqi}
                bandLabel={band.label}
                bandVerdict={band.verdict}
                bandColor={band.textColor}
                cities={sorted}
                onSelect={setSelectedId}
                istClock={istClock}
              />
            ) : (
              <ReadingPlaceholder
                loading={loading}
                error={error}
              />
            )}
          </div>
        </div>
      </div>

      {/* Attribution travels with the photograph: most of these are CC BY-SA,
          which requires the author, the licence and a route back to the
          original. It also tells the reader what they are looking at. */}
      <div className="mx-auto flex max-w-data flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-gutter pt-3 text-micro text-smoke-500 sm:px-6 lg:px-gutter-lg">
        <p>
          {photo.title}
          {city ? ` · haze at ${city.name}'s reading` : null}
        </p>
        <p>
          <a
            href={photo.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-smoke-700 underline-offset-2 transition-colors duration-tap ease-air hover:text-smoke-300"
          >
            {photo.artist}
          </a>
          {" · "}
          {photo.licenseUrl ? (
            <a
              href={photo.licenseUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-smoke-700 underline-offset-2 transition-colors duration-tap ease-air hover:text-smoke-300"
            >
              {photo.license}
            </a>
          ) : (
            photo.license
          )}
        </p>
      </div>
    </section>
  );
}

function Reading({
  city,
  aqi,
  bandLabel,
  bandVerdict,
  bandColor,
  cities,
  onSelect,
  istClock,
}: {
  city: CityWithLatest;
  aqi: number;
  bandLabel: string;
  bandVerdict: string;
  bandColor: string;
  cities: CityWithLatest[];
  onSelect: (id: number) => void;
  istClock: string | null;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="u-label text-smoke-300">Right now in</span>
        <CitySwitcher city={city} cities={cities} onSelect={onSelect} />
      </div>

      <h1
        id="hero-reading"
        className="mt-1 flex flex-wrap items-end gap-x-5 gap-y-1 sm:gap-x-8"
      >
        <span
          className="u-figure text-mega"
          style={{ color: bandColor }}
          // The number is the headline, so it gets read as one — with its
          // unit, which the visual label beside it supplies silently.
          aria-label={`Air quality index ${Math.round(aqi)}, ${bandLabel}`}
        >
          {Math.round(aqi)}
        </span>
        <span className="mb-1 sm:mb-3 lg:mb-5">
          <span className="block font-serif text-lead font-normal text-smoke-100">
            {bandVerdict}
          </span>
          <span className="mt-1 block u-label" style={{ color: bandColor }}>
            AQI · {bandLabel} on the CPCB scale
          </span>
        </span>
      </h1>

      <dl className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-smoke-700/70 pt-3 text-micro text-smoke-300 tnum sm:gap-x-8">
        <Fact label="PM2.5">
          {city.latest_pm25 != null
            ? `${city.latest_pm25.toFixed(0)} µg/m³`
            : "—"}
        </Fact>
        <Fact label="Reading for">{istClock ?? "unknown hour"}</Fact>
        <Fact label="Updated">{formatTimestamp(city.latest_timestamp)}</Fact>
        <Fact label="Source">{sourceLabel(city.latest_source)}</Fact>
      </dl>
    </div>
  );
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

/**
 * The honest loading state: the real layout's geometry, at the real sizes,
 * saying what is actually happening. The backend sleeps on Render's free tier
 * and takes ~30s to wake, so "waking the backend" is more useful than a
 * spinner — and if it has genuinely failed, the error says so rather than
 * shimmering forever.
 */
function ReadingPlaceholder({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  return (
    <div>
      <p className="u-label text-smoke-300">Right now in</p>
      <h1 id="hero-reading" className="sr-only">
        Today&rsquo;s air quality across thirty Indian cities
      </h1>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div
          className={`h-[clamp(4.5rem,14vw,12rem)] w-[clamp(9rem,26vw,22rem)] ${
            error ? "bg-smoke-850" : "skeleton"
          }`}
        />
        <div className="mb-2 space-y-2">
          <div className={`h-6 w-40 ${error ? "bg-smoke-850" : "skeleton"}`} />
          <div className={`h-3 w-56 ${error ? "bg-smoke-850" : "skeleton"}`} />
        </div>
      </div>
      <p className="mt-4 border-t border-smoke-700/70 pt-3 font-serif text-body text-smoke-200">
        {error
          ? `No reading yet — ${error}`
          : loading
            ? "Waking the backend. It sleeps when nobody's looking and takes about thirty seconds to come back."
            : "No readings available for any city right now."}
      </p>
    </div>
  );
}

/**
 * A 120px rule on the right edge that fills as the haze thickens, labelled
 * with the value it is on its way to. Motion that explains itself: without
 * it, a reader who scrolls slowly sees the photograph degrade and has no way
 * to know that is the data talking.
 *
 * Decorative in the accessibility sense — the same numbers are in the reading
 * two inches to its left — so it is hidden from the tree, and it is hidden
 * outright on phones, where there is no room for a second explanation.
 */
function HazeMeter({ aqi }: { aqi: number | null }) {
  if (aqi == null) return null;
  return (
    <div
      aria-hidden
      className="absolute bottom-32 right-gutter-lg hidden flex-col items-end gap-2 lg:flex"
    >
      <span className="u-label text-smoke-300">Haze</span>
      <div className="relative h-32 w-px bg-smoke-100/20">
        <div
          className="absolute inset-x-0 bottom-0 bg-[color:var(--accent)]"
          style={{ height: "calc(var(--haze-p, 0) * 100%)" }}
        />
      </div>
      <span className="u-figure text-micro text-smoke-300">
        {Math.round(aqi)}
      </span>
    </div>
  );
}
