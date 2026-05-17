/**
 * About / How it works page.
 *
 * Two-column on desktop: prose on the left, a sticky meta rail on the
 * right (stack, links, quick facts). Single column on mobile. Section
 * dividers + numbered headings give the long-form copy visual rhythm
 * so it doesn't read as one undifferentiated wall of text.
 */

import { Link } from "react-router-dom";

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

export default function About() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <header className="mb-10 sm:mb-14 max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-200/60 mb-3">
            About · How it works
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-ink-100 leading-tight">
            A dashboard that answers <em className="text-ink-100/90">"should I go outside?"</em>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-ink-200 leading-relaxed">
            Quick-glance air quality for the 30 most populated Indian cities — no
            charts you have to decipher, just one honest sentence per city.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 lg:gap-16">
          <main className="min-w-0 divide-y divide-ink-700/40">
            <Section number="01" title="Why it exists">
              Air quality in Indian cities can swing from "fine" to "stay inside"
              within a few hours. Most AQI dashboards bury you in charts and
              forget to answer the actual question you have:{" "}
              <em>should I go for a run?</em> This site tries to answer it in
              one sentence per city.
            </Section>

            <Section number="02" title="How the data works">
              Every hour, a background job hits the{" "}
              <ExternalLink href="https://waqi.info/">WAQI</ExternalLink> API
              for each monitored city and stores the reading in a small SQLite
              database. If WAQI rate-limits us or a station is down, a
              synthetic-data fallback keeps the dashboard alive with values
              that follow the typical Indian diurnal pollution curve — morning
              and evening peaks, overnight troughs.
            </Section>

            <Section number="03" title="How the forecast works">
              <p>
                A <Code>RandomForestRegressor</Code> with 120 trees is trained
                on the rolling history. Features are hour-of-day, day-of-week,
                month, the last three AQI readings, and 6h / 24h rolling means.
                For the 24-hour forecast the model is applied{" "}
                <em>recursively</em>: each prediction is fed back into the lag
                features for the next step.
              </p>
              <p className="mt-4">
                The confidence band on the forecast chart comes from the
                variance of predictions across the 120 trees — wide band, lower
                confidence. The model retrains every 24 hours; if it drifts out
                of sync with reality, give it a day to catch up.
              </p>
            </Section>

            <Section number="04" title="Who built this">
              <p>
                Built by{" "}
                <ExternalLink href="https://github.com/ishaan2947">
                  Ishaan Nigam
                </ExternalLink>
                . Software engineer — currently at BNSF Railway, joining PwC
                in July 2026. CS grad from Texas A&M, May 2025.
              </p>
              <p className="mt-4">
                Source is on{" "}
                <ExternalLink href="https://github.com/ishaan2947/India_AQI">
                  GitHub
                </ExternalLink>{" "}
                — pull requests welcome. Reach me on{" "}
                <ExternalLink href="https://linkedin.com/in/ishaan-nigam/">
                  LinkedIn
                </ExternalLink>
                .
              </p>
            </Section>

            <div className="pt-8">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm text-ink-200 hover:text-ink-100 transition group"
              >
                <span className="transition-transform group-hover:-translate-x-0.5">←</span>
                Back to the map
              </Link>
            </div>
          </main>

          <aside className="lg:sticky lg:top-24 lg:self-start space-y-8 text-sm">
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

            <RailBlock label="Links">
              <ul className="space-y-1.5">
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
            </RailBlock>
          </aside>
        </div>
      </div>
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
