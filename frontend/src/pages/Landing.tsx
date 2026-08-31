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
 * type sits above the photograph rather than on it, the Taj is left
 * completely unobstructed, and the base of the frame dissolves into the page
 * background so the stats below read as part of the image rather than a
 * separate box bolted underneath it.
 *
 * The crop is deliberately low in the frame (object-position 58%) so the
 * building rides high in the band and lands inside the first screenful
 * instead of below the fold.
 */

import { useEffect, useRef, useState } from "react";
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
// hard bright line across the screen, so the scrim starts opaque and fades
// out. It falls off fast: the crop now sits low enough in the frame that the
// dome is only ~10% down the band, and a slower fade would leave the building
// veiled in exactly the place we want it seen. The bottom one runs heavier
// because the live stats sit on it and need a dark bed to stay legible.
const TOP_SCRIM =
  "linear-gradient(to bottom, #0b1220 0%, rgba(11,18,32,0.45) 5%, rgba(11,18,32,0.12) 13%, rgba(11,18,32,0) 24%)";
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

  // The photograph is not decoration: its subject sits at 27.1767, 78.0081,
  // which is a city this site monitors. So the hero can report the air in the
  // frame you are looking at. Falls away silently if Agra ever drops out of
  // the tracked set or has no reading.
  const { data: cities } = useCurrentAQI();
  const pictured =
    cities?.find((c) => c.name.toLowerCase() === "agra") ?? null;
  const picturedAqi = pictured?.latest_aqi ?? null;

  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 pb-7 sm:pt-12 sm:pb-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dusk-300 mb-3">
            Live air quality · 30 Indian cities
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-ink-100 leading-[1.05]">
            Should you go outside?
          </h1>
          <p className="mt-4 text-base sm:text-lg text-ink-200 leading-relaxed max-w-xl mx-auto">
            Real-time air quality and 24-hour forecasts for the thirty largest
            cities in India — answered in one sentence per city, not a wall of
            charts.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
      <div className="group relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-[21/9] w-full overflow-hidden">
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
          className={`relative h-full w-full object-cover object-[center_58%] transition-[opacity,transform] duration-700 ease-out motion-safe:group-hover:scale-[1.02] ${
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

        {picturedAqi != null && pictured ? (
          <Link
            to={`/cities/${pictured.id}`}
            className="absolute bottom-20 left-4 sm:bottom-28 sm:left-6 lg:left-8 z-10 max-w-[calc(100%-2rem)] rounded-lg border border-white/10 bg-ink-900/55 px-3.5 py-2.5 backdrop-blur-md transition duration-300 hover:border-white/30 hover:bg-ink-900/80"
          >
            <p className="text-[9px] uppercase tracking-[0.18em] text-dusk-300/80">
              In this photograph
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: getAQIColor(picturedAqi) }}
              />
              <span className="font-mono text-sm font-bold tabular-nums text-ink-100">
                {Math.round(picturedAqi)}
              </span>
              <span className="truncate text-ink-200">
                Agra
                <span className="hidden sm:inline">
                  {" · "}
                  {getAQICategory(picturedAqi)}
                </span>
              </span>
              <span className="text-ink-200/40 transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </p>
          </Link>
        ) : null}
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
    <Reveal className="pb-10 sm:pb-14">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 backdrop-blur-md">
        <StatCard
          to={top ? `/cities/${top.city_id}` : "/map"}
          label="Worst right now"
          note={top ? getAQICategory(top.aqi_value) : "Waiting on the backend"}
          cta="view city"
        >
          {top ? (
            <div className="flex items-baseline gap-2.5">
              <span
                className="font-mono text-2xl font-bold tabular-nums"
                style={{ color: getAQIColor(top.aqi_value) }}
              >
                {Math.round(top.aqi_value)}
              </span>
              <span className="truncate font-medium text-ink-100">
                {top.city_name}
              </span>
            </div>
          ) : (
            <div className="skeleton h-7 w-32" />
          )}
        </StatCard>

        <StatCard
          to="/map"
          label="Cities tracked"
          note="Every major metro"
          cta="open the map"
        >
          <div className="font-mono text-2xl font-bold tabular-nums text-ink-100">
            {tracked ?? "—"}
          </div>
        </StatCard>

        <StatCard
          to="/predictions"
          label="Last reading"
          note="Hourly, from WAQI"
          cta="see forecasts"
        >
          <div className="text-2xl font-semibold tracking-tight text-ink-100">
            {formatTimestamp(latest)}
          </div>
        </StatCard>
      </div>
    </Reveal>
  );
}

/**
 * One live number, and a place to go because of it — every card is a real
 * destination, so the hover state is signalling something rather than
 * decorating.
 *
 * That hover is the whole interaction budget for this page: a hairline draws
 * itself across the top edge, the link text comes up out of the murk, the
 * arrow moves half a step. No glow, no lift, no bounce. Restraint is the
 * thing that reads as professional — an effect should either tell you
 * something is clickable or it shouldn't be there.
 */
function StatCard({
  to,
  label,
  note,
  cta,
  children,
}: {
  to: string;
  label: string;
  note: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group relative bg-ink-900/70 px-5 py-4 transition-colors duration-200 hover:bg-ink-800/85"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-dusk-300/80 via-dusk-300/25 to-transparent transition-transform duration-300 ease-out group-hover:scale-x-100"
      />
      <StatLabel>{label}</StatLabel>
      <div className="mt-1.5">{children}</div>
      <p className="mt-1 flex items-center gap-2 text-xs">
        <span className="truncate text-ink-200/70">{note}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-ink-200/35 transition-colors duration-200 group-hover:text-ink-100">
          {cta}
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </p>
    </Link>
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

          <Reveal className="pt-8">
            <Link
              to="/map"
              className="group inline-flex items-center gap-2 text-sm font-medium text-ink-100 transition hover:text-white"
            >
              Open the live map
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </Reveal>
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
      <Reveal className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
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
              . Software engineer at PwC on the Sightline AI team. CS grad
              from Texas A&amp;M, May 2025. Source is on{" "}
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
      </Reveal>
    </section>
  );
}

/**
 * Fades a block up the first time it scrolls into view.
 *
 * Three deliberate constraints, because this effect is very easy to overdo:
 * it fires *once* — the observer disconnects on the first intersection, so
 * nothing re-animates when you scroll back up, which is what makes the
 * pattern feel cheap; the travel is 16px, far enough to read as motion and
 * short enough that it never looks like the layout is assembling itself; and
 * anyone whose OS asks for reduced motion gets the content immediately with
 * no transform at all. Same fallback if IntersectionObserver is missing —
 * failure mode is "content is simply there", never "content never appears".
 */
function useReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      // Held back slightly from the bottom edge so a block starts moving
      // just after it clears the fold, rather than the instant it touches it.
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return {
    ref,
    style: { transitionDelay: shown ? `${delay}ms` : "0ms" },
    className: `transition-[opacity,transform] duration-700 ease-out ${
      shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    }`,
  };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reveal = useReveal<HTMLDivElement>(delay);
  return (
    <div ref={reveal.ref} style={reveal.style} className={`${reveal.className} ${className}`}>
      {children}
    </div>
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
  const reveal = useReveal<HTMLElement>((Number(number) - 1) * 70);
  return (
    <section
      ref={reveal.ref}
      style={reveal.style}
      className={`py-7 sm:py-9 first:pt-0 ${reveal.className}`}
    >
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
  const reveal = useReveal<HTMLDivElement>();
  return (
    <div ref={reveal.ref} style={reveal.style} className={reveal.className}>
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
