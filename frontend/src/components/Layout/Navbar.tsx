import { Link, NavLink } from "react-router-dom";

const linkBase = "px-3 py-1.5 rounded-md text-sm font-medium transition";
const linkInactive = "text-ink-200 hover:text-ink-100 hover:bg-ink-700";
const linkActive = "bg-ink-700 text-ink-100";

// FastAPI serves its Swagger UI at /docs on the backend host. In production
// the backend is on a different origin than the frontend, so we have to
// resolve the full URL — pointing at the SPA's /docs would just re-render
// the React app via Vercel's rewrite-to-index.
function getDocsUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase) {
    // e.g. "https://aqi-india-api.onrender.com/api" → "https://aqi-india-api.onrender.com/docs"
    return apiBase.replace(/\/api\/?$/, "") + "/docs";
  }
  // Dev fallback — Vite's proxy only covers /api, not /docs.
  return "http://localhost:8000/docs";
}

const DOCS_URL = getDocsUrl();

export default function Navbar() {
  return (
    <header className="bg-ink-800 border-b border-ink-700 px-6 h-14 flex items-center justify-between">
      <Link to="/" className="flex items-baseline gap-3 group">
        <span className="h-6 w-6 self-center rounded-md bg-gradient-to-br from-aqi-good via-aqi-moderate to-aqi-unhealthy shadow" />
        <span className="text-ink-100 font-semibold tracking-tight">
          AQI India
        </span>
        <span className="hidden md:inline text-xs text-ink-200/70 italic">
          what to breathe before stepping outside
        </span>
      </Link>

      <nav className="flex items-center gap-1">
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
