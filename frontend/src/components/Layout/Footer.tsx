/**
 * Slim attribution footer. Lives at the bottom of the main app shell.
 *
 * Deliberately understated — one line of microcopy, real links, no widgets.
 */

export default function Footer() {
  return (
    <footer className="border-t border-ink-700 bg-ink-900 text-[11px] text-ink-200/70 px-6 py-2 flex flex-wrap items-center justify-between gap-2">
      <div>
        Built by{" "}
        <a
          href="https://github.com/ishaan2947"
          target="_blank"
          rel="noreferrer noopener"
          className="text-ink-100 hover:underline"
        >
          Ishaan Nigam
        </a>
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
      </div>
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/ishaan2947/India_AQI"
          target="_blank"
          rel="noreferrer noopener"
          className="hover:text-ink-100 transition"
        >
          Source on GitHub →
        </a>
      </div>
    </footer>
  );
}
