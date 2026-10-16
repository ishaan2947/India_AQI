/**
 * One chart system, so every chart on the site is recognisably the same
 * instrument.
 *
 * Recharts' defaults are the giveaway on half the dashboards on the internet:
 * a full cartesian grid in both directions, a white tooltip card with a drop
 * shadow, axis ticks in whatever grey the theme forgot to set, and a legend
 * box for a single series. The rules here are the opposite of each of those:
 *
 *   - Horizontal gridlines only, 1px, barely there. Vertical gridlines
 *     compete with the data for a reader who is scanning left to right.
 *   - No legend when a direct label will do.
 *   - Tabular figures on every axis, so a tick changing from 99 to 100
 *     doesn't shift the column.
 *   - Units and timezone belong on the axis, not inside a tooltip the reader
 *     has to go hunting for.
 */

import type { CSSProperties } from "react";

export const CHART = {
  grid: "#231F1D",
  axis: "#302B28",
  tick: "#8A837A",
  label: "#B3ABA2",
  plot: "#0C0B0A",
  now: "#B3ABA2",
} as const;

// Typed loosely on purpose: Recharts hands `tick` straight to an SVG <text>,
// whose prop type is SVGProps<SVGTextElement> and not CSSProperties — the two
// disagree about a handful of inherited keys.
export const axisTick = {
  fill: CHART.tick,
  fontSize: 11,
  style: { fontVariantNumeric: "tabular-nums" } as CSSProperties,
};

export const axisLine = { stroke: CHART.axis } as const;

/**
 * The CPCB bands as horizontal stripes behind the plot.
 *
 * This is the single highest-value piece of chart furniture on the site: with
 * the bands painted in, a reader never has to consult a legend to know
 * whether 180 is bad — the line is sitting in the yellow. The alphas are low
 * enough that the series always wins.
 */
export const BAND_STRIPES: Array<{ from: number; to: number; fill: string }> = [
  { from: 0, to: 50, fill: "rgba(79, 166, 75, 0.14)" },
  { from: 50, to: 100, fill: "rgba(159, 201, 60, 0.12)" },
  { from: 100, to: 200, fill: "rgba(242, 215, 59, 0.10)" },
  { from: 200, to: 300, fill: "rgba(240, 139, 51, 0.12)" },
  { from: 300, to: 400, fill: "rgba(229, 75, 56, 0.13)" },
  { from: 400, to: 1000, fill: "rgba(168, 38, 43, 0.16)" },
];
