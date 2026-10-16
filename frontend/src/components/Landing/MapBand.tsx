/**
 * The handoff to the map, built out of the same thirty readings rather than a
 * screenshot of the thing it links to.
 *
 * Each city is plotted at its real coordinates on a bare graticule — no
 * coastline, no tiles, nothing but the data and four lines of latitude. At
 * this scale the cities *are* the outline of India, which is the point: the
 * cluster across the Indo-Gangetic plain is the story every winter, and it
 * shows up here as a band of orange before the reader has opened the map at
 * all.
 *
 * Positions use a cosine-corrected longitude so the constellation keeps its
 * real proportions instead of being stretched sideways, which is also exactly
 * what the Web Mercator basemap on /map does at these latitudes.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useCurrentAQI } from "../../hooks/useAQIData";
import { getAQIBand, getMarkerSize } from "../../utils/aqiHelpers";
import { Reveal, RevealWords } from "../motion/Reveal";

// Padded a little beyond the extremes of the monitored set (Amritsar 31.6°N,
// Kochi 9.9°N, Mumbai 72.6°E, Guwahati 91.7°E) so no dot touches an edge.
const FRAME = { latMin: 7.5, latMax: 33.5, lngMin: 69.5, lngMax: 93.5 };
const MEAN_LAT_COS = Math.cos((20.5 * Math.PI) / 180);
const PARALLELS = [15, 20, 25, 30];
const MERIDIANS = [75, 80, 85, 90];

function project(lat: number, lng: number): { x: number; y: number } {
  const lngSpan = (FRAME.lngMax - FRAME.lngMin) * MEAN_LAT_COS;
  const x = ((lng - FRAME.lngMin) * MEAN_LAT_COS) / lngSpan;
  const y = (FRAME.latMax - lat) / (FRAME.latMax - FRAME.latMin);
  return { x: x * 100, y: y * 100 };
}

export default function MapBand() {
  const { data: cities } = useCurrentAQI();

  const plotted = useMemo(() => {
    const withReadings = (cities ?? []).filter((c) => c.latest_aqi != null);
    // Worst last, so the hottest dots paint on top of their neighbours.
    return withReadings
      .slice()
      .sort((a, b) => (a.latest_aqi ?? 0) - (b.latest_aqi ?? 0))
      .map((c) => ({
        ...c,
        ...project(c.lat, c.lng),
        band: getAQIBand(c.latest_aqi ?? 0),
      }));
  }, [cities]);

  // The three worst keep their labels permanently; everything else labels on
  // hover, so the plot doesn't turn into a word cloud.
  const named = useMemo(
    () =>
      new Set(
        plotted
          .slice()
          .sort((a, b) => (b.latest_aqi ?? 0) - (a.latest_aqi ?? 0))
          .slice(0, 3)
          .map((c) => c.id),
      ),
    [plotted],
  );

  return (
    <section
      className="border-t border-smoke-700 bg-smoke-900"
      aria-labelledby="map-band-heading"
    >
      <div className="mx-auto max-w-data px-gutter py-band sm:px-6 lg:px-gutter-lg lg:py-band-lg">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-20">
          <div>
            <h2 id="map-band-heading" className="text-display text-smoke-100">
              <RevealWords text="The plain is the" />
              <br />
              <RevealWords text="problem" delay={110} />
            </h2>
            <Reveal delay={60}>
              <p className="u-prose mt-5 max-w-prose">
                Plotted at their own coordinates, the thirty cities draw the
                shape of the country. For most of the year the worst of them
                line up along the Indo-Gangetic plain, where crop burning,
                winter inversions and four hundred million people share the
                same still air — which is a pattern you can watch arrive and
                break up here, hour by hour.
              </p>
              <p className="u-prose mt-4 max-w-prose">
                The live map has every station, a muted basemap and the same
                colour scale. It is the version of this you can pan.
              </p>
              <Link
                to="/map"
                className="group mt-7 inline-flex items-baseline gap-3 border-b border-[color:var(--accent)] pb-1.5 text-head text-smoke-100 transition-colors duration-tap ease-air hover:text-white"
              >
                Open the live map
                <span
                  aria-hidden
                  className="transition-transform duration-move ease-air group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </Reveal>
          </div>

          {/* Decorative in the accessibility sense: every value in here is in
              the ranked table above, in order, as text. */}
          <Reveal className="w-full" delay={120}>
            <div
              aria-hidden
              className="relative mx-auto aspect-[21/25] w-full max-w-[26rem] border border-smoke-800 bg-smoke-950"
            >
              {PARALLELS.map((lat) => {
                const { y } = project(lat, FRAME.lngMin);
                return (
                  <div
                    key={`p${lat}`}
                    className="absolute inset-x-0 border-t border-dashed border-smoke-800"
                    style={{ top: `${y}%` }}
                  >
                    <span className="absolute left-1 -top-4 text-[10px] text-smoke-600 tnum">
                      {lat}°N
                    </span>
                  </div>
                );
              })}
              {MERIDIANS.map((lng) => {
                const { x } = project(FRAME.latMin, lng);
                return (
                  <div
                    key={`m${lng}`}
                    className="absolute inset-y-0 border-l border-dashed border-smoke-800"
                    style={{ left: `${x}%` }}
                  >
                    <span className="absolute bottom-1 left-1 text-[10px] text-smoke-600 tnum">
                      {lng}°E
                    </span>
                  </div>
                );
              })}

              {plotted.map((c) => {
                const size = getMarkerSize(c.latest_aqi ?? 0) * 0.5;
                return (
                  <div
                    key={c.id}
                    className="group absolute"
                    style={{ left: `${c.x}%`, top: `${c.y}%` }}
                  >
                    <div
                      className="-translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: size,
                        height: size,
                        background: c.band.color,
                        opacity: 0.88,
                      }}
                    />
                    {/* Labels flip to the inside of the plot once a dot is
                        past two-thirds across, so a city on the east coast
                        doesn't hang its name over the next column. */}
                    <span
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] leading-none text-smoke-200 transition-opacity duration-tap ease-air ${
                        c.x > 66 ? "right-1/2 mr-3 text-right" : "left-1/2 ml-3"
                      } ${
                        named.has(c.id)
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {c.name}{" "}
                      <span className="u-figure" style={{ color: c.band.textColor }}>
                        {Math.round(c.latest_aqi ?? 0)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
