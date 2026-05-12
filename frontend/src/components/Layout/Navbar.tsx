import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";

const linkBase = "px-3 py-1.5 rounded-md text-sm font-medium transition";
const linkInactive = "text-ink-200 hover:text-ink-100 hover:bg-ink-700";
const linkActive = "bg-ink-700 text-ink-100";

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

/**
 * Tiny status dot in the navbar — polls /healthz and signals whether
 * the backend is awake. A real engineer's touch; lets the user know
 * up-front if the next request is going to be slow.
 */
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
          // If the first request took >5s, the backend was sleeping but is
          // now waking up — show yellow until it's been quick for a beat.
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

const HEALTH_STYLES: Record<Health, { color: string; label: string }> = {
  unknown: { color: "bg-ink-600", label: "Checking backend…" },
  live: { color: "bg-aqi-good", label: "Backend live" },
  waking: { color: "bg-aqi-moderate", label: "Backend waking up" },
  down: { color: "bg-aqi-unhealthy", label: "Backend not responding" },
};

export default function Navbar() {
  const health = useBackendHealth();
  const style = HEALTH_STYLES[health];

  return (
    <header className="sticky top-0 z-[2000] bg-ink-800/80 backdrop-blur-md border-b border-ink-700 px-6 h-14 flex items-center justify-between">
      <Link to="/" className="flex items-baseline gap-3 group">
        <span className="h-6 w-6 self-center rounded-md bg-gradient-to-br from-aqi-good via-aqi-moderate to-aqi-unhealthy shadow ring-1 ring-white/10" />
        <span className="text-ink-100 font-semibold tracking-tight">
          AQI India
        </span>
        <span className="hidden md:inline text-xs text-ink-200/70 italic">
          what to breathe before stepping outside
        </span>
      </Link>

      <nav className="flex items-center gap-1">
        <span
          className="hidden sm:flex items-center gap-1.5 mr-2 text-[11px] text-ink-200/80"
          title={style.label}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${style.color} ${
              health === "live" ? "animate-pulse" : ""
            }`}
          />
          <span className="font-mono uppercase tracking-wider">
            {health === "live" ? "live" : health === "waking" ? "waking" : health === "down" ? "down" : "—"}
          </span>
        </span>

        <NavLink
          to="/"
          end
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          Map
        </NavLink>
        <NavLink
          to="/predictions"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          Forecasts
        </NavLink>
        <NavLink
          to="/about"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          About
        </NavLink>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer noopener"
          className={`${linkBase} ${linkInactive}`}
          title="Open the FastAPI Swagger UI"
        >
          API
        </a>
      </nav>
    </header>
  );
}
