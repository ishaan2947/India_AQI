/**
 * The end of the page: who made it, what it is made of, where to go next.
 *
 * This is also the landing page's footer — the global one is suppressed on
 * `/` (see App.tsx), because a 24px attribution strip pinned under an
 * editorial page is the kind of detail that makes a site feel assembled
 * rather than designed.
 */

import { Link } from "react-router-dom";

import { Reveal } from "../motion/Reveal";

const LINKS: Array<[string, string]> = [
  ["GitHub repository", "https://github.com/ishaan2947/India_AQI"],
  ["LinkedIn", "https://linkedin.com/in/ishaan-nigam/"],
  ["WAQI, the data source", "https://waqi.info/"],
  ["Photograph on Unsplash", "https://unsplash.com/photos/DDiLYt_F88w"],
];

export default function Colophon() {
  return (
    <footer className="border-t border-smoke-700 bg-smoke-900">
      <Reveal className="mx-auto max-w-data px-gutter py-band sm:px-6 lg:px-gutter-lg">
        <div className="grid gap-10 sm:grid-cols-[1fr_auto] sm:gap-20">
          <div className="max-w-prose">
            <p className="u-label mb-4">Colophon</p>
            <p className="u-prose">
              Built by{" "}
              <a
                href="https://github.com/ishaan2947"
                target="_blank"
                rel="noreferrer noopener"
              >
                Ishaan Nigam
              </a>
              , a software engineer at PwC on the Sightline AI team and a 2025
              computer science graduate of Texas A&amp;M. The backend is
              FastAPI on Render's free tier, the frontend is Vite on Vercel,
              and the whole thing costs nothing a month to run — which is most
              of why it is built the way it is.{" "}
              <Link to="/how-it-works">The full account is here.</Link>
            </p>
          </div>

          <nav aria-label="Elsewhere">
            <p className="u-label mb-4">Elsewhere</p>
            <ul className="space-y-2">
              {LINKS.map(([label, href]) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group inline-flex items-baseline gap-2 text-body text-smoke-200 transition-colors duration-tap ease-air hover:text-smoke-100"
                  >
                    {label}
                    <span
                      aria-hidden
                      className="text-smoke-600 transition-transform duration-move ease-air group-hover:translate-x-0.5 group-hover:text-[color:var(--accent)]"
                    >
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-16 text-micro text-smoke-500">
          Air quality readings are indicative, not regulatory. For health
          decisions, check your state pollution control board.
        </p>
      </Reveal>
    </footer>
  );
}
