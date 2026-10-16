/**
 * The page's accent colour is whatever the air says it is.
 *
 * Rules, focus rings, hover states and the scroll meter all read `--accent`,
 * so when the hero is showing a 280 the page is orange, and on a clean day
 * the same page is olive green. That is the point of DESIGN.md principle 2 —
 * colour here is a measurement, not a logo.
 *
 * Two properties because the scale has two colours per band: `--accent` is
 * the lightened variant, safe for glyphs and 1px rules; `--accent-fill` is
 * the saturated one, for areas and dots. Reset on unmount so a page without
 * a reading doesn't inherit the last one.
 */

import { useEffect, useRef } from "react";

export function useAccent(
  textColor: string | null,
  fillColor: string | null,
  inkColor: string | null = null,
  /**
   * How long to wait before applying a *change* (the first value is always
   * immediate).
   *
   * These two properties live on the root element, so writing them
   * invalidates style for the entire document — and on the landing page the
   * moment they change is the moment the hero photograph is cross-fading,
   * which is the worst possible time to ask for a full style recalculation.
   * Holding the change until the dissolve is underway costs nothing visually
   * and buys back the frames. It reads better, too: the picture changes, then
   * the page's accent follows it.
   */
  deferMs = 0,
): void {
  const applied = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (!textColor) return;

    const apply = () => {
      root.style.setProperty("--accent", textColor);
      root.style.setProperty("--accent-fill", fillColor ?? textColor);
      // Read by `.on-paper`, where the lightened accent would vanish.
      root.style.setProperty("--accent-ink", inkColor ?? fillColor ?? textColor);
      applied.current = true;
    };

    if (!applied.current || deferMs === 0) {
      apply();
      return;
    }

    const timer = window.setTimeout(apply, deferMs);
    return () => window.clearTimeout(timer);
  }, [textColor, fillColor, inkColor, deferMs]);

  // Separate from the write above so a colour change doesn't tear the
  // properties off the root on its way to replacing them.
  useEffect(() => {
    const root = document.documentElement;
    return () => {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-fill");
      root.style.removeProperty("--accent-ink");
      applied.current = false;
    };
  }, []);
}
