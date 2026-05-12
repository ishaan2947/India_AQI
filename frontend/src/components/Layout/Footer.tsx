/**
 * Slim attribution footer. Lives at the bottom of the main app shell.
 *
 * Deliberately understated — one line of microcopy, real links, no widgets.
 * On phones it compresses to a single shorter line; full attribution at sm+.
 */

export default function Footer() {
  return (
    <footer
      className="border-t border-ink-700 bg-ink-900 text-[11px] text-ink-200/70 px-3 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-3 whitespace-nowrap"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      <div className="truncate">
        Built by{" "}
        <a
          href="https://github.com/ishaan2947"
          target="_blank"
          rel="noreferrer noopener"
          className="text-ink-100 hover:underline"
        >
          Ishaan Nigam
        </a>
        <span className="hidden sm:inline">
          . Air-quality data from{" "}
          <a
            href="https://waqi.info/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink-100 hover:underline"
          >
            WAQI
          </a>
          . Forecast model retrains nightly.
        </span>
      </div>
      <a
        href="https://github.com/ishaan2947/India_AQI"
        target="_blank"
        rel="noreferrer noopener"
        className="shrink-0 hover:text-ink-100 transition"
      >
        <span className="hidden sm:inline">Source on </span>GitHub →
      </a>
    </footer>
  );
}
