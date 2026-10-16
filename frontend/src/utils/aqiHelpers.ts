/**
 * Everything that turns a bare AQI number into something a person can read:
 * band, colour, verdict, advice, and the freshness of the reading.
 *
 * Bands are **CPCB's** (Central Pollution Control Board, India), not the US
 * EPA's. Two reasons: this is an Indian site graded the way India grades
 * itself, and the EPA scale compresses the exact range most of these cities
 * live in — above 200 the EPA has two bands where CPCB has three, so a Delhi
 * winter reads as one undifferentiated block of red.
 *
 * Provenance caveat, stated here and in the UI rather than buried: the
 * readings come from WAQI, which publishes on the US EPA index. We show those
 * values against CPCB band names. The indices agree closely in spirit and
 * differ in detail; /how-it-works says so in plain words.
 *
 * Two colours per band — see DESIGN.md §3.2. `color` fills shapes, `textColor`
 * carries glyphs. The severe maroon is 2.8:1 on the page ground, which is
 * unusable for type at any size, so anything setting `color:` on text reads
 * `textColor` and the distinction is not optional.
 */

import type { AQICategory } from "../types";

const CATEGORIES: AQICategory[] = [
  {
    key: "good",
    label: "Good",
    verdict: "Go outside",
    description: "Air quality is clean. No restrictions for anyone.",
    color: "#4FA64B",
    textColor: "#7FD177",
    min: 0,
    max: 50,
  },
  {
    key: "satisfactory",
    label: "Satisfactory",
    verdict: "Fine for most",
    description:
      "Minor breathing discomfort is possible for unusually sensitive people.",
    color: "#9FC93C",
    textColor: "#BFE05C",
    min: 51,
    max: 100,
  },
  {
    key: "moderate",
    label: "Moderate",
    verdict: "Ease up if sensitive",
    description:
      "Breathing discomfort for people with asthma, and for the elderly, children, and those with heart or lung disease.",
    color: "#F2D73B",
    textColor: "#F7E364",
    min: 101,
    max: 200,
  },
  {
    key: "poor",
    label: "Poor",
    verdict: "Skip the run",
    description:
      "Breathing discomfort for most people on prolonged exposure. Cut outdoor exertion.",
    color: "#F08B33",
    textColor: "#F8A95C",
    min: 201,
    max: 300,
  },
  {
    key: "veryPoor",
    label: "Very poor",
    verdict: "Stay indoors",
    description:
      "Respiratory illness on prolonged exposure. Effects are more pronounced for people with heart or lung disease.",
    color: "#E54B38",
    textColor: "#F4705D",
    min: 301,
    max: 400,
  },
  {
    key: "severe",
    label: "Severe",
    verdict: "Don't go out",
    description:
      "Affects healthy people and seriously affects anyone with an existing condition. Emergency conditions.",
    color: "#A8262B",
    textColor: "#E86E72",
    min: 401,
    max: Number.POSITIVE_INFINITY,
  },
];

function pickCategory(aqi: number): AQICategory {
  for (const cat of CATEGORIES) {
    if (aqi >= cat.min && aqi <= cat.max) return cat;
  }
  return CATEGORIES[CATEGORIES.length - 1];
}

/** The whole band, for callers that need more than one field off it. */
export function getAQIBand(aqi: number): AQICategory {
  return pickCategory(aqi);
}

/** Fill colour — bars, dots, areas, rules. */
export function getAQIColor(aqi: number): string {
  return pickCategory(aqi).color;
}

/** Text colour — use this, not `getAQIColor`, whenever colouring glyphs. */
export function getAQITextColor(aqi: number): string {
  return pickCategory(aqi).textColor;
}

export function getAQICategory(aqi: number): string {
  return pickCategory(aqi).label;
}

/** Two or three words: what to do about today. */
export function getAQIVerdict(aqi: number): string {
  return pickCategory(aqi).verdict;
}

export function getAQIDescription(aqi: number): string {
  return pickCategory(aqi).description;
}

export function getAllCategories(): AQICategory[] {
  return CATEGORIES;
}

/**
 * How thick the haze sits over the hero, 0..1.
 *
 * Floor at 40 rather than 0 because nowhere in this dataset is ever truly
 * clean, and a frame that stays pristine until 50 would make the effect look
 * broken. Ceiling at 400 — the top of CPCB's "very poor" band — so a severe
 * episode pins the overlay rather than running off the end of the scale.
 */
export function getHazeDensity(aqi: number | null | undefined): number {
  if (aqi == null || Number.isNaN(aqi)) return 0;
  const linear = Math.max(0, Math.min(1, (aqi - 40) / 360));
  // Bent toward the middle of the range on purpose. Most Indian readings sit
  // between 150 and 300, and a linear map spends that whole interval in the
  // bottom half of the effect, where nothing visible happens. The exponent
  // pushes 200–300 into territory you can actually see while leaving a clean
  // day clean (AQI 55 lands at 0.08) and a severe one pinned at 1.
  return Math.pow(linear, 0.78);
}

/**
 * Map AQI value to a marker diameter in pixels. Larger AQI ⇒ larger marker.
 */
export function getMarkerSize(aqi: number): number {
  const clamped = Math.max(20, Math.min(400, aqi));
  return 18 + (clamped / 400) * 28; // 18..46 px
}

/**
 * The backend stores naive UTC (`datetime.utcnow()`), so its timestamps come
 * over the wire without a zone designator — and `new Date("2026-01-01T08:00")`
 * is parsed as *local* time by every browser. Left alone that put every
 * reading hours out: a viewer in IST saw readings dated five and a half hours
 * in the future, a viewer in New York saw them five hours stale.
 *
 * So: if the string carries no zone, say so explicitly before parsing.
 */
export function parseApiTimestamp(
  ts: string | null | undefined,
): Date | null {
  if (!ts) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(ts);
  const d = new Date(hasZone ? ts : `${ts}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "2 hours ago" style relative time.
 *
 * Anything older than ~12h collapses to "recently" rather than "14d ago".
 * The dashboard seeds from a build-time snapshot whose timestamps can lag the
 * deploy by days; surfacing that raw delta makes a healthy site look
 * abandoned. Once the live fetch lands the real timestamp wins anyway.
 */
export function formatTimestamp(ts: string | null | undefined): string {
  const then = parseApiTimestamp(ts);
  if (!then) return "recently";

  const diffSec = Math.round((Date.now() - then.getTime()) / 1000);
  // A reading timestamped slightly ahead of us (clock skew between the
  // Render box and the viewer) should read as current, not negative.
  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 12) return `${diffHr}h ago`;

  return "recently";
}

/**
 * The reading's own wall-clock hour in India, e.g. "14:00 IST".
 *
 * Relative time answers "is this fresh?"; this answers "which hour am I
 * looking at?" — which matters for AQI, because the curve has a shape and
 * 06:00 and 14:00 mean very different things. Both get shown together.
 */
export function formatISTClock(ts: string | null | undefined): string | null {
  const d = parseApiTimestamp(ts);
  if (!d) return null;
  try {
    const hhmm = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    return `${hhmm} IST`;
  } catch {
    // Intl without the tz database (very old engines) — better to say
    // nothing than to print a wrong hour.
    return null;
  }
}

/**
 * The hour of the reading in India, 0-23, as a number.
 *
 * Charts and the forecast grid label their axes in IST because that is the
 * clock the air is on: an 08:00 peak means the morning rush in Delhi, not
 * whatever time it happens to be where the reader is sitting.
 */
export function getISTHour(ts: string | null | undefined): number | null {
  const d = parseApiTimestamp(ts);
  if (!d) return null;
  try {
    const hh = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(d);
    const n = Number(hh);
    return Number.isFinite(n) ? n % 24 : null;
  } catch {
    return null;
  }
}

/** "21:00" in IST, for axis ticks and labels. */
export function formatISTHourLabel(ts: string | null | undefined): string {
  const h = getISTHour(ts);
  return h == null ? "" : `${String(h).padStart(2, "0")}:00`;
}

/**
 * Hour-of-day label, e.g. "14:00". Used on chart axes, where the reader has
 * already been told the zone by the axis title.
 */
export function formatHour(ts: string): string {
  const d = parseApiTimestamp(ts);
  if (!d) return "";
  return `${d.getHours().toString().padStart(2, "0")}:00`;
}

/**
 * One-line, opinionated advice for what to actually do at a given AQI.
 *
 * Less "consult your physician" boilerplate, more "should I leave the house?"
 * Thresholds follow the CPCB bands above, so the sentence and the colour can
 * never disagree.
 */
export function getAQIAdvice(aqi: number): string {
  const { key } = pickCategory(aqi);
  switch (key) {
    case "good":
      return "Open the windows — the air's clean today.";
    case "satisfactory":
      return "Fine for everyone. Sensitive folks: keep an eye on symptoms.";
    case "moderate":
      return "If you have asthma or run long distances, ease up today. Everyone else is OK.";
    case "poor":
      return "Cut outdoor cardio. Wear a mask if you'll be out more than 30 minutes.";
    case "veryPoor":
      return "Stay inside if you can. N95 outdoors, windows shut, purifier on.";
    case "severe":
      return "Hazardous. Avoid going out at all. N95 if you absolutely must.";
  }
}
