/**
 * Landing page — the front door of the site.
 *
 * Structure: a photographic hero, a strip of *live* numbers pulled from the
 * real API, then the condensed how-it-works. The live strip is the point —
 * anyone can write "real-time dashboard" in a paragraph; showing the worst
 * city in India as of four minutes ago proves the thing actually runs.
 *
 * The hero art direction is driven by the photograph's own vertical
 * brightness profile (sampled off the source file, not eyeballed): the top
 * quarter of the frame is bright empty sky — luma ~170-210, hopeless for
 * white type — and the bottom third is dark garden at luma ~50-80. So the
 * headline sits in a scrimmed band at the top, the Taj itself is left
 * completely unobstructed, and the base of the frame dissolves into the page
 * background so the stats below read as part of the image rather than a
 * separate box bolted underneath it.
 */

import { useState } from "react";
import { Link } from "react-router-dom";

import { useCurrentAQI, useWorstCities } from "../hooks/useAQIData";
import {
  formatTimestamp,
  getAQICategory,
  getAQIColor,
} from "../utils/aqiHelpers";

// 20px-wide blur of the hero, inlined so the frame is never an empty black
// rectangle: it paints on the first frame, then the real file fades over it.
const HERO_LQIP =
  "data:image/webp;base64,UklGRogAAABXRUJQVlA4IHwAAAAwBACdASoUAA4APu1iqU2ppaQiMAgBMB2JZQCdIHGJ/gPIqRxGO8aH9MAA/pBJEzRVF/kVf/7/zNjPBFKJUtU9eR5QiCRHGlbjyvihAl8LDLineUeqP62eLTUiKs35uNuBhG3DTggWcc6HruTG/g3JAeMineKY/MUwwAAA";

// Stops chosen against the sampled luma curve. The top of the frame is pale
// sky at luma ~185 meeting a page at luma ~18 — left alone that seam is a
// hard bright line across the screen, so the scrim starts opaque and is gone
// by the time the sky turns golden. The bottom one runs heavier because the
// live stats sit on it and need a dark bed to stay legible.
const TOP_SCRIM =
  "linear-gradient(to bottom, #0b1220 0%, rgba(11,18,32,0.66) 11%, rgba(11,18,32,0.22) 28%, rgba(11,18,32,0) 46%)";
const BOTTOM_SCRIM =
  "linear-gradient(to top, #0b1220 0%, rgba(11,18,32,0.94) 15%, rgba(11,18,32,0.42) 34%, rgba(11,18,32,0) 58%)";

const STACK = [
  "FastAPI",
  "SQLAlchemy 2",
  "Pydantic v2",
  "scikit-learn",
  "APScheduler",
  "httpx",
  "React 18",
  "TypeScript",
  "Vite",
  "Tailwind",
  "Leaflet",
  "Recharts",
];

const FACTS: Array<[string, string]> = [
  ["Cities tracked", "30"],
  ["Refresh cadence", "Hourly"],
  ["Forecast horizon", "24 hours"],
  ["Model", "Random Forest · 120 trees"],
  ["Hosting cost", "$0 / month"],
];

export default function Landing() {
  return (
    <div className="h-full overflow-y-auto">
      <Hero />
      <HowItWorks />
      <Colophon />
    </div>
  );
}

function Hero() {
  const [loaded, setLoaded] = useState(false);

  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 pb-10 sm:pt-20 sm:pb-14">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dusk-300 mb-4">
            Live air quality · 30 Indian cities
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-ink-100 leading-[1.05]">
            Should you go outside?
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ink-200 leading-relaxed max-w-xl mx-auto">
            Real-time air quality and 24-hour forecasts for the thirty largest
            cities in India — answered in one sentence per city, not a wall of
            charts.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/map"
              className="group inline-flex items-center gap-2 rounded-full bg-ink-100 px-5 py-2.5 text-sm font-semibold text-ink-900 shadow-lg shadow-black/30 transition hover:bg-white"
            >
              Open the live map
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("how-it-works")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center rounded-full border border-white/20 bg-ink-900/40 px-5 py-2.5 text-sm font-medium text-ink-100 backdrop-blur-sm transition hover:border-white/40 hover:bg-ink-900/60"
            >
              How it works
            </a>
          </div>
        </div>
      </div>

      {/* The photograph gets its own band rather than sitting behind the type.
          Deliberate: the building is dead centre in the frame and the headline
          would land straight on the dome, so a full-bleed treatment means
          either veiling the Taj behind a scrim or shoving the type somewhere
          it doesn't belong. Aspect ratios rather than viewport heights, so the
          crop is predictable — 4:3 on a phone is close to the frame's native
          shape, and it widens as the screen does. */}
      <div className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-[21/9] w-full overflow-hidden">
        {/* The blur sits underneath, so there is something to look at for the
            few hundred milliseconds before the real frame decodes. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${HERO_LQIP}")` }}
        />
        <img
          src="/hero-taj-1600.webp"
          srcSet="/hero-taj-900.webp 900w, /hero-taj-1600.webp 1600w, /hero-taj-2400.webp 2400w"
          sizes="100vw"
          alt="The Taj Mahal at sunset, mirrored in the long water channel of its garden"
          width={2400}
          height={1728}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`relative h-full w-full object-cover object-[center_45%] transition-opacity duration-700 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
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
      </div>

      {/* Pulled up into the base of the photograph, where the bottom scrim has
          already faded the garden into the page colour — the numbers read as
          part of the image instead of a box bolted underneath it. */}
      <div className="relative z-10 -mt-14 sm:-mt-20 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <LiveStrip />
      </div>
    </section>
  );
}

/**
 * Three live numbers. Seeded from the build-time snapshot (see
 * data/snapshot.ts) so this never renders empty or shifts layout while the
 * backend wakes up — the real values swap in underneath when they land.
 */
function LiveStrip() {
  const { data: worst } = useWorstCities();
  const { data: cities } = useCurrentAQI();

  const top = worst?.entries?.[0] ?? null;
  const tracked = cities?.length ?? null;
  const latest =
    cities?.reduce<string | null>((acc, c) => {
      if (!c.latest_timestamp) return acc;
      return !acc || c.latest_timestamp > acc ? c.latest_timestamp : acc;
    }, null) ?? null;

  return (
    <div className="pb-10 sm:pb-14">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 backdrop-blur-md">
        {top ? (
          <Link
            to={`/cities/${top.city_id}`}
            className="group bg-ink-900/70 px-5 py-4 transition hover:bg-ink-800/80"
          >
            <StatLabel>Worst right now</StatLabel>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span
                className="font-mono text-2xl font-bold tabular-nums"
                style={{ color: getAQIColor(top.aqi_value) }}
              >
                {Math.round(top.aqi_value)}
              </span>
              <span className="text-ink-100 font-medium truncate">
                {top.city_name}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-200/70 truncate">
              {getAQICategory(top.aqi_value)}
              <span className="text-ink-200/40 transition group-hover:text-ink-200/80">
                {" · view city →"}
              </span>
            </p>
          </Link>
        ) : (
          <div className="bg-ink-900/70 px-5 py-4">
            <StatLabel>Worst right now</StatLabel>
            <div className="skeleton mt-2 h-7 w-32" />
          </div>
        )}

        <div className="bg-ink-900/70 px-5 py-4">
          <StatLabel>Cities tracked</StatLabel>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-ink-100">
            {tracked ?? "—"}
          </div>
          <p className="mt-1 text-xs text-ink-200/70">
            Every major metro, coast to coast
          </p>
        </div>

        <div className="bg-ink-900/70 px-5 py-4">
          <StatLabel>Last reading</StatLabel>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-100">
            {formatTimestamp(latest)}
          </div>
          <p className="mt-1 text-xs text-ink-200/70">
            Collected hourly from WAQI stations
          </p>
        </div>
      </div>
    </div>
  );
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.18em] text-ink-200/60">
      {children}
    </p>
  );
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-6 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 lg:gap-16">
        <div className="min-w-0 divide-y divide-ink-700/40">
          <Section number="01" title="Why it exists">
            Air quality in Indian cities can swing from "fine" to "stay inside"
            within a few hours. Most AQI dashboards bury you in charts and
            forget to answer the actual question you have:{" "}
            <em>should I go for a run?</em> This site tries to answer it in one
            sentence per city.
          </Section>

          <Section number="02" title="Where the data comes from">
            Every hour a background job hits the{" "}
            <ExternalLink href="https://waqi.info/">WAQI</ExternalLink> API for
            each monitored city and stores the reading in SQLite. If WAQI
            rate-limits us or a station drops offline, a synthetic fallback
            keeps the dashboard alive with values that follow the typical Indian
            diurnal pollution curve — morning and evening peaks, overnight
            troughs.
          </Section>

          <Section number="03" title="How the forecast works">
            <p>
              A <Code>RandomForestRegressor</Code> with 120 trees trains on the
              rolling history. Features are hour-of-day, day-of-week, month, the
              last three AQI readings, and 6h / 24h rolling means. For the
              24-hour forecast the model runs <em>recursively</em> — each
              prediction is fed back into the lag features for the next step.
            </p>
            <p className="mt-4">
              The confidence band on the forecast chart comes from the variance
              across the 120 trees: wide band, lower confidence. The model
              retrains every 24 hours, so if it drifts out of sync with reality,
              give it a day to catch up.
            </p>
          </Section>

          <div className="pt-8">
            <Link
              to="/map"
              className="group inline-flex items-center gap-2 text-sm font-medium text-ink-100 transition hover:text-white"
            >
              Open the live map
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start space-y-8 text-sm">
          <RailBlock label="At a glance">
            <dl className="divide-y divide-ink-700/40 border-y border-ink-700/40">
              {FACTS.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-200/70">{k}</dt>
                  <dd className="text-ink-100 font-mono tabular-nums text-right">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </RailBlock>

          <RailBlock label="Stack">
            <div className="flex flex-wrap gap-1.5">
              {STACK.map((t) => (
                <span
                  key={t}
                  className="text-[11px] font-mono bg-ink-800/70 border border-ink-700/60 text-ink-100 px-2 py-0.5 rounded"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-200/70 leading-relaxed">
              Backend on Render free tier, frontend on Vercel.
            </p>
          </RailBlock>
        </aside>
      </div>
    </section>
  );
}

function Colophon() {
  return (
    <section className="border-t border-ink-700/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-8 items-start">
          <div className="max-w-xl">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-200/60 mb-3">
              Who built this
            </p>
            <p className="text-ink-200 leading-relaxed">
              Built by{" "}
              <ExternalLink href="https://github.com/ishaan2947">
                Ishaan Nigam
              </ExternalLink>
              . Software engineer — currently at BNSF Railway, joining PwC in
              July 2026. CS grad from Texas A&amp;M, May 2025. Source is on{" "}
              <ExternalLink href="https://github.com/ishaan2947/India_AQI">
                GitHub
              </ExternalLink>{" "}
              — pull requests welcome.
            </p>
          </div>

          <ul className="space-y-1.5 text-sm sm:text-right">
            <li>
              <ExternalLink href="https://github.com/ishaan2947/India_AQI">
                GitHub repository
              </ExternalLink>
            </li>
            <li>
              <ExternalLink href="https://linkedin.com/in/ishaan-nigam/">
                LinkedIn
              </ExternalLink>
            </li>
            <li>
              <ExternalLink href="https://waqi.info/">
                WAQI data source
              </ExternalLink>
            </li>
          </ul>
        </div>

        <p className="mt-10 text-xs text-ink-200/40">
          Photograph by{" "}
          <ExternalLink href="https://unsplash.com/@shanelahi">
            Shan Elahi
          </ExternalLink>{" "}
          on{" "}
          <ExternalLink href="https://unsplash.com/photos/DDiLYt_F88w">
            Unsplash
          </ExternalLink>
          .
        </p>
      </div>
    </section>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-7 sm:py-9 first:pt-0">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-xs font-mono text-ink-200/50 tabular-nums">
          {number}
        </span>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink-100">
          {title}
        </h2>
      </div>
      <div className="text-ink-200 leading-relaxed text-[15px] sm:text-base max-w-prose">
        {children}
      </div>
    </section>
  );
}

function RailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-200/60 mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-ink-100 underline decoration-ink-600 hover:decoration-ink-100 transition"
    >
      {children}
    </a>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.85em] bg-ink-800 border border-ink-700 px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}
