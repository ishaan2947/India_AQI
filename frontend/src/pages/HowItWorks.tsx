/**
 * Where the technical detail went.
 *
 * The landing page used to carry an "At a glance" rail of monospace
 * key/values and twelve framework chips, which is a CV pinned to a dashboard.
 * The facts are worth keeping — they are the interesting part of a $0/month
 * production service — so they live here instead, set in proportional type,
 * with the caveats that a chip can't express.
 *
 * Deliberately one column of writing. This page is read, not scanned.
 */

import { Link } from "react-router-dom";

import { ScaleLegend } from "../components/Landing/RightNow";
import { Reveal, RevealWords } from "../components/motion/Reveal";

const FACTS: Array<[string, string]> = [
  ["Cities tracked", "30"],
  ["Refresh cadence", "Hourly"],
  ["Forecast horizon", "24 hours, recursive"],
  ["Model", "Random forest, 120 trees"],
  ["Retraining", "Every 24 hours"],
  ["Store", "SQLite, single file"],
  ["Hosting", "Render free tier + Vercel"],
  ["Cost to run", "$0 / month"],
];

const LAYERS: Array<[string, string]> = [
  ["Backend", "FastAPI, SQLAlchemy 2, Pydantic v2, APScheduler, httpx"],
  ["Modelling", "scikit-learn, joblib-pickled model on disk"],
  ["Frontend", "React 18, TypeScript, Vite, Tailwind, Leaflet, Recharts"],
  ["Checks", "ruff, mypy, pytest on every pull request"],
];

export default function HowItWorks() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-data px-gutter py-band sm:px-6 lg:px-gutter-lg">
        <div>
          <p className="u-label mb-5">How it works</p>
          <h1 className="max-w-[19ch] text-display text-smoke-100">
            <RevealWords text="A production service that costs nothing to run" />
          </h1>
          <Reveal className="u-prose mt-6 max-w-prose" delay={80}>
            <p>
              Thirty cities, hourly readings, a 24-hour forecast per city, and
              a bill of zero. The constraint is the design: everything here is
              chosen so the whole system fits inside free tiers without
              pretending it is bigger than it is.
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-14 grid gap-12 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-20">
          <div className="max-w-prose u-prose">
            <h2 className="text-head text-smoke-100">The cold start</h2>
            <p className="mt-3">
              Render's free tier puts the backend to sleep after fifteen
              minutes of nobody looking, and waking it takes about thirty
              seconds — uvicorn boot plus the SQLite seed. Three things hide
              that: the app fires a health ping the moment it loads, every
              dataset is seeded from a snapshot baked into the bundle at build
              time, and the service worker serves the last response it saw
              while it revalidates. So the page paints real numbers
              immediately, and the loading states you do see are honest about
              what they are waiting for.
            </p>

            <h2 className="mt-12 text-head text-smoke-100">
              Which AQI scale this is
            </h2>
            <p className="mt-3">
              Readings come from WAQI, which publishes on the <em>US EPA</em>{" "}
              index. The bands, labels and colours on this site are{" "}
              <em>CPCB's</em> — India's own scale — because the audience is
              Indian and because above 200 the EPA has two categories where
              CPCB has three, which flattens exactly the range most of these
              cities live in.
            </p>
            <p className="mt-4">
              The two indices agree closely in spirit and differ in detail: a
              value is converted from pollutant concentrations slightly
              differently under each, so treat a number near a boundary as near
              a boundary rather than as a verdict. Readings are indicative, not
              regulatory.
            </p>
            <ScaleLegend withNote={false} />

            <h2 className="mt-12 text-head text-smoke-100">
              When the data isn't real
            </h2>
            <p className="mt-3">
              If WAQI rate-limits the job or a station goes dark, a synthetic
              reading is generated along the typical Indian diurnal curve so
              the series stays continuous and the charts stay readable. Those
              values are labelled <em>synthetic fallback</em> wherever they are
              shown — in the hero, on the city cards and in the map popups.
            </p>

            <h2 className="mt-12 text-head text-smoke-100">The forecast</h2>
            <p className="mt-3">
              A <code className="font-mono text-[0.9em]">RandomForestRegressor</code>{" "}
              with 120 trees, trained on the rolling history with hour-of-day,
              day-of-week, month, the last three readings and the 6h/24h
              rolling means as features. The 24-hour horizon is produced
              recursively, so uncertainty compounds with distance; the
              confidence band on the chart is the spread across the trees.
            </p>
            <p className="mt-4">
              <Link to="/predictions">See what it currently expects</Link>, or
              read the API it comes out of.
            </p>
          </div>

          <div>
            <h2 className="u-label">At a glance</h2>
            <dl className="mt-3 border-t border-smoke-800">
              {FACTS.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-6 border-b border-smoke-800 py-2.5"
                >
                  <dt className="text-micro text-smoke-500">{k}</dt>
                  <dd className="text-right text-body text-smoke-100 tnum">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            <h2 className="u-label mt-12">What it's made of</h2>
            <dl className="mt-3 border-t border-smoke-800">
              {LAYERS.map(([layer, items]) => (
                <div key={layer} className="border-b border-smoke-800 py-3">
                  <dt className="text-micro text-smoke-500">{layer}</dt>
                  <dd className="mt-1 text-body text-smoke-200">{items}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-8 text-micro leading-relaxed text-smoke-500">
              The design system for the interface — palette, type scale, motion
              rules — is written down in DESIGN.md in the repository, for the
              same reason the API has a schema.
            </p>
          </div>
        </Reveal>

        <Reveal className="mt-16 border-t border-smoke-800 pt-8">
          <Link
            to="/"
            className="group inline-flex items-baseline gap-2 text-body font-semibold text-smoke-100 transition-colors duration-tap ease-air hover:text-white"
          >
            <span
              aria-hidden
              className="text-[color:var(--accent)] transition-transform duration-move ease-air group-hover:-translate-x-1"
            >
              ←
            </span>
            Back to today's air
          </Link>
        </Reveal>
      </div>
    </div>
  );
}
