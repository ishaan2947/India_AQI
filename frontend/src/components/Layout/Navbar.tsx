/**
 * Masthead.
 *
 * What went: a gradient square standing in for a logo, an italic tagline
 * beside it ("what to breathe before stepping outside"), and a pulsing green
 * LIVE pill. All three were the site talking about itself.
 *
 * What replaced them: a text wordmark, and silence from the status indicator
 * as long as the backend is healthy. A dot that is green 99% of the time
 * carries no information — so this one says nothing when things are fine and
 * speaks in words, in the AQI palette, when the API is waking or down, which
 * is the only time a reader needs to know it exists.
 */

import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";

// FastAPI serves its Swagger UI at /docs on the backend host. In production
// the backend is on a different origin than the frontend, so we have to
// resolve the full URL — pointing at the SPA's /docs would just re-render
// the React app via Vercel's rewrite-to-index.
function getApiHostUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase) {
    return apiBase.replace(/\/api\/?$/, "");
  }
  return "http://localhost:8000";
}

const API_HOST = getApiHostUrl();
const DOCS_URL = `${API_HOST}/docs`;
const HEALTH_URL = `${API_HOST}/healthz`;

type Health = "unknown" | "live" | "waking" | "down";

/** Polls /healthz so a slow first request can be explained before it happens. */
function useBackendHealth(): Health {
  const [health, setHealth] = useState<Health>("unknown");

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const check = async () => {
      const started = performance.now();
      try {
        const res = await fetch(HEALTH_URL, { cache: "no-store" });
        const elapsed = performance.now() - started;
        if (cancelled) return;
        if (res.ok) {
          setHealth(elapsed > 5_000 ? "waking" : "live");
        } else {
          setHealth("down");
        }
      } catch {
        if (cancelled) return;
        setHealth("down");
      }
      timer = window.setTimeout(check, 30_000);
    };

    check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return health;
}

const NAV: Array<[string, string, boolean]> = [
  // [path, label, visible on phones]
  ["/", "Today", true],
  ["/map", "Map", true],
  ["/predictions", "Forecasts", true],
  ["/how-it-works", "How it works", false],
];

export default function Navbar() {
  const health = useBackendHealth();

  return (
    <header
      className="sticky top-0 z-[2000] border-b border-smoke-700 bg-smoke-950"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-14 max-w-data items-center justify-between gap-4 px-gutter sm:px-6 lg:px-gutter-lg">
        <Link
          to="/"
          className="font-display text-[0.8125rem] font-bold uppercase tracking-wordmark text-smoke-100 transition-colors duration-tap ease-air hover:text-white"
          style={{ fontVariationSettings: '"wdth" 106' }}
        >
          AQI&nbsp;India
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <BackendNotice health={health} />

          {NAV.map(([to, label, onPhone]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `${onPhone ? "" : "hidden sm:inline-block "}u-label px-2 py-2 transition-colors duration-tap ease-air ${
                  isActive
                    ? "text-smoke-100"
                    : "text-smoke-500 hover:text-smoke-200"
                }`
              }
            >
              {({ isActive }) => (
                <span
                  className={`border-b pb-1 transition-colors duration-tap ease-air ${
                    isActive
                      ? "border-[color:var(--accent)]"
                      : "border-transparent"
                  }`}
                >
                  {label}
                </span>
              )}
            </NavLink>
          ))}

          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="u-label hidden px-2 py-2 text-smoke-500 transition-colors duration-tap ease-air hover:text-smoke-200 lg:inline-block"
            title="Open the FastAPI Swagger UI"
          >
            API
          </a>
        </nav>
      </div>
    </header>
  );
}

/**
 * Silent when healthy. "Waking" is worth saying because the next click will
 * take thirty seconds; "offline" is worth saying because the numbers on
 * screen are then coming from the build-time snapshot rather than from today.
 */
function BackendNotice({ health }: { health: Health }) {
  if (health === "live" || health === "unknown") return null;

  const waking = health === "waking";
  return (
    <span
      className="u-label mr-1 hidden sm:inline-block"
      style={{ color: waking ? "#F7E364" : "#F4705D" }}
      title={
        waking
          ? "The backend is waking from sleep; the first request takes about 30 seconds."
          : "The backend is not responding. Showing the last known readings."
      }
    >
      {waking ? "Backend waking" : "Backend offline"}
    </span>
  );
}
