/**
 * Three beats of writing, unnumbered.
 *
 * The old version of this was `01 Why it exists`, `02 Where the data comes
 * from`, `03 How the forecast works` — section numbers on a page with three
 * sections, which is the tell of a template rather than a decision. Here each
 * beat leads with the sentence that matters, set in the serif at lead size,
 * and the lead is the only thing that uses the word-by-word reveal: the
 * sentence that frames the data assembles itself, the explanation underneath
 * it simply fades in. Animating every paragraph would turn reading into
 * waiting.
 */

import { Link } from "react-router-dom";

import { Reveal, RevealWords } from "../motion/Reveal";

export default function Story() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-t border-smoke-700 bg-smoke-950"
      aria-label="How this works"
    >
      <div className="mx-auto max-w-data px-gutter py-band sm:px-6 lg:px-gutter-lg lg:py-band-lg">
        <Beat
          label="The question"
          lead="Air in an Indian city can go from fine to stay-inside in four hours."
        >
          <p>
            Which makes the daily average almost useless and the dashboards
            that show you fourteen charts worse than useless. The question
            anyone actually has is small and immediate —{" "}
            <em>can I take the kids to the park at six?</em> — so the front
            page of this site is one city, one number and one instruction, and
            everything else is downstream of that.
          </p>
        </Beat>

        <Beat
          label="The data"
          lead="Thirty cities, once an hour, for as long as the server stays awake."
        >
          <p>
            A background job hits the{" "}
            <a href="https://waqi.info/" target="_blank" rel="noreferrer noopener">
              WAQI
            </a>{" "}
            API for each monitored city every hour and writes the reading to
            SQLite. When WAQI rate-limits us or a station drops offline, a
            synthetic fallback keeps the series continuous by following the
            typical Indian diurnal curve — morning and evening peaks, an
            overnight trough.
          </p>
          <p className="mt-4">
            Those substituted readings are labelled <em>synthetic fallback</em>{" "}
            everywhere they appear, including in the hero above. A gap in the
            data is a fact about the data; papering over it silently would be a
            worse bug than the gap.
          </p>
        </Beat>

        <Beat
          label="The forecast"
          lead="A forecast is a guess with error bars, and the bars are the honest part."
        >
          <p>
            A random forest of 120 trees trains on the rolling history. It sees
            hour-of-day, day-of-week, month, the last three readings, and the
            6-hour and 24-hour rolling means. For the 24-hour horizon it runs
            recursively — each prediction is fed back in as a lag feature for
            the next step, so error compounds with distance, exactly as the
            widening band on the forecast chart shows.
          </p>
          <p className="mt-4">
            That band is the spread across the 120 trees: where they disagree,
            it is wide and you should trust the number less. The model retrains
            every 24 hours, so if reality drifts away from it, give it a day.
          </p>
        </Beat>

        <Reveal className="mt-10 flex flex-wrap items-baseline gap-x-10 gap-y-4">
          <StoryLink to="/predictions">See the 24-hour forecasts</StoryLink>
          <StoryLink to="/map">Open the live map</StoryLink>
          <StoryLink to="/how-it-works">
            Stack, costs and caveats
          </StoryLink>
        </Reveal>
      </div>
    </section>
  );
}

function Beat({
  label,
  lead,
  children,
}: {
  label: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-x-16 gap-y-5 border-b border-smoke-800 py-10 first:pt-0 lg:grid-cols-[1fr_minmax(0,32rem)] lg:py-14">
      <div>
        <p className="u-label mb-4 text-smoke-500">{label}</p>
        <p className="max-w-[22ch] font-serif text-display font-normal leading-[1.08] text-smoke-100 sm:max-w-[20ch]">
          <RevealWords text={lead} />
        </p>
      </div>
      <Reveal className="u-prose max-w-prose lg:pt-14" delay={90}>
        {children}
      </Reveal>
    </div>
  );
}

function StoryLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group inline-flex items-baseline gap-2 text-body font-semibold text-smoke-100 transition-colors duration-tap ease-air hover:text-white"
    >
      {children}
      <span
        aria-hidden
        className="text-[color:var(--accent)] transition-transform duration-move ease-air group-hover:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}
