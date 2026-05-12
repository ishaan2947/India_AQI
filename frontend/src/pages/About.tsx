/**
 * About / How it works page.
 *
 * Deliberately written in a personal voice — short paragraphs, one clear
 * idea each. Resists the "Mission · Vision · Values" marketing-page trap.
 */

import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10 overflow-y-auto h-full">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-ink-200/70">About</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-ink-100">
          What is this?
        </h1>
        <p className="text-ink-200 text-lg leading-relaxed">
          A quick-glance dashboard for whether you should mask up, shut your
          windows, or just open them and step outside. Built for the 30 most
          populated Indian cities.
        </p>
      </header>

      <Section title="Why it exists">
        Air quality in Indian cities can swing from "fine" to "stay inside"
        within a few hours. Most AQI dashboards bury you in charts and forget
        to answer the actual question you have: <em>should I go for a run?</em>{" "}
        This site tries to answer it in one sentence per city.
      </Section>

      <Section title="How the data works">
        Every hour, a background job hits the{" "}
        <ExternalLink href="https://waqi.info/">WAQI</ExternalLink> API for each
        monitored city and stores the reading in a small SQLite database. If
        WAQI rate-limits us or a station is down, a synthetic-data fallback
        keeps the dashboard alive with values that follow the typical Indian
        diurnal pollution curve (morning + evening peaks, overnight troughs).
      </Section>

      <Section title="How the forecast works">
        A <Code>RandomForestRegressor</Code> with 120 trees is trained on the
        rolling history. Features are hour-of-day, day-of-week, month, the
        last three AQI readings, and 6h / 24h rolling means. For the 24-hour
        forecast the model is applied <em>recursively</em>: each prediction is
        fed back into the lag features for the next step.
        <br />
        <br />
        The confidence band you see on the forecast chart is derived from the
        variance of predictions across the 120 trees — wide band, lower
        confidence. The model retrains itself every 24 hours; if it gets out
        of sync with reality, give it a day and it'll catch up.
      </Section>

      <Section title="Stack">
        <span className="block text-ink-200 leading-loose">
          <Tag>FastAPI</Tag> <Tag>SQLAlchemy 2</Tag> <Tag>Pydantic v2</Tag>{" "}
          <Tag>scikit-learn</Tag> <Tag>APScheduler</Tag> <Tag>httpx</Tag>{" "}
          <Tag>React 18</Tag> <Tag>TypeScript</Tag> <Tag>Vite</Tag>{" "}
          <Tag>Tailwind</Tag> <Tag>Leaflet</Tag> <Tag>Recharts</Tag>
        </span>
        <br />
        Backend on Render's free tier, frontend on Vercel. Total cost: $0/month.
      </Section>

      <Section title="Who built this">
        Built by{" "}
        <ExternalLink href="https://github.com/ishaan2947">
          Ishaan Nigam
        </ExternalLink>
        . Software engineer — currently at BNSF Railway, joining PwC in July
        2026. CS grad from Texas A&M, May 2025.
        <br />
        <br />
        Source code is on{" "}
        <ExternalLink href="https://github.com/ishaan2947/India_AQI">
          GitHub
        </ExternalLink>{" "}
        — pull requests welcome. Reach me on{" "}
        <ExternalLink href="https://linkedin.com/in/ishaan-nigam/">
          LinkedIn
        </ExternalLink>
        .
      </Section>

      <div className="pt-4">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-ink-200 hover:text-ink-100 transition"
        >
          ← Back to the map
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-ink-100 mb-3">
        {title}
      </h2>
      <div className="text-ink-200 leading-relaxed">{children}</div>
    </section>
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[11px] font-mono bg-ink-800 border border-ink-700 text-ink-100 px-2 py-0.5 rounded mr-1 mb-1">
      {children}
    </span>
  );
}
