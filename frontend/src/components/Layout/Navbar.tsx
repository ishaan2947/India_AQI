import { Link, NavLink } from "react-router-dom";

const linkBase = "px-3 py-1.5 rounded-md text-sm font-medium transition";
const linkInactive = "text-ink-200 hover:text-ink-100 hover:bg-ink-700";
const linkActive = "bg-ink-700 text-ink-100";

export default function Navbar() {
  return (
    <header className="bg-ink-800 border-b border-ink-700 px-6 h-14 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 group">
        <span className="h-7 w-7 rounded-md bg-gradient-to-br from-aqi-good via-aqi-moderate to-aqi-unhealthy shadow" />
        <span className="text-ink-100 font-semibold tracking-tight">
          AQI India <span className="text-ink-200 font-normal">Intelligence</span>
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
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className={`${linkBase} ${linkInactive}`}
        >
          API
        </a>
      </nav>
    </header>
  );
}
