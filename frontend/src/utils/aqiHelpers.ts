/**
 * Helpers for mapping a numeric AQI value to colours, category labels, and
 * health descriptions per the standard US EPA breakpoints. Also a tiny
 * "time-ago" formatter used by the cards and map popups.
 */

import type { AQICategory } from "../types";

const CATEGORIES: AQICategory[] = [
  {
    key: "good",
    label: "Good",
    description: "Air quality is satisfactory; pollution poses little or no risk.",
    color: "#00E400",
    min: 0,
    max: 50,
  },
  {
    key: "moderate",
    label: "Moderate",
    description:
      "Acceptable air quality, but unusually sensitive individuals may experience minor effects.",
    color: "#FFFF00",
    min: 51,
    max: 100,
  },
  {
    key: "sensitive",
    label: "Unhealthy for Sensitive Groups",
    description:
      "Members of sensitive groups (children, elderly, asthma) may experience health effects.",
    color: "#FF7E00",
    min: 101,
    max: 150,
  },
  {
    key: "unhealthy",
    label: "Unhealthy",
    description:
      "Everyone may begin to experience health effects; sensitive groups feel them more strongly.",
    color: "#FF0000",
    min: 151,
    max: 200,
  },
  {
    key: "veryUnhealthy",
    label: "Very Unhealthy",
    description: "Health alert: everyone may experience more serious health effects.",
    color: "#8F3F97",
    min: 201,
    max: 300,
  },
  {
    key: "hazardous",
    label: "Hazardous",
    description: "Emergency conditions — the entire population is likely to be affected.",
    color: "#7E0023",
    min: 301,
    max: Number.POSITIVE_INFINITY,
  },
];

function pickCategory(aqi: number): AQICategory {
  for (const cat of CATEGORIES) {
    if (aqi >= cat.min && aqi <= cat.max) return cat;
  }
  return CATEGORIES[CATEGORIES.length - 1];
}

export function getAQIColor(aqi: number): string {
  return pickCategory(aqi).color;
}

export function getAQICategory(aqi: number): string {
  return pickCategory(aqi).label;
}

export function getAQIDescription(aqi: number): string {
  return pickCategory(aqi).description;
}

export function getAllCategories(): AQICategory[] {
  return CATEGORIES;
}

/**
 * Map AQI value to a marker diameter in pixels. Larger AQI ⇒ larger marker.
 */
export function getMarkerSize(aqi: number): number {
  const clamped = Math.max(20, Math.min(400, aqi));
  return 18 + (clamped / 400) * 28; // 18..46 px
}

/**
 * "2 hours ago" style relative time.
 */
export function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return "—";
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return "—";

  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

/**
 * Hour-of-day label, e.g. "14:00".
 */
export function formatHour(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:00`;
}
