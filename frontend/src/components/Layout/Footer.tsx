/**
 * Slim attribution strip for the app pages (map, forecasts, city detail),
 * where the layout is a fixed-height shell and there is no room for a real
 * colophon. The landing page suppresses it and ends with one instead — see
 * App.tsx.
 *
 * One line, real links, no widgets.
 */

export default function Footer() {
  return (
    <footer
      className="flex items-center justify-between gap-3 whitespace-nowrap border-t border-smoke-700 bg-smoke-950 px-gutter py-1.5 text-[11px] text-smoke-500 sm:px-6 sm:py-2"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      <div className="truncate">
        Built by{" "}
        <a
          href="https://github.com/ishaan2947"
          target="_blank"
          rel="noreferrer noopener"
          className="text-smoke-300 transition-colors duration-tap ease-air hover:text-smoke-100"
        >
          Ishaan Nigam
        </a>
        <span className="hidden sm:inline">
          . Readings from{" "}
          <a
            href="https://waqi.info/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-smoke-300 transition-colors duration-tap ease-air hover:text-smoke-100"
          >
            WAQI
          </a>
          , shown against CPCB bands. Indicative, not regulatory.
        </span>
      </div>
      <a
        href="https://github.com/ishaan2947/India_AQI"
        target="_blank"
        rel="noreferrer noopener"
        className="shrink-0 transition-colors duration-tap ease-air hover:text-smoke-100"
      >
        <span className="hidden sm:inline">Source on </span>GitHub ↗
      </a>
    </footer>
  );
}
