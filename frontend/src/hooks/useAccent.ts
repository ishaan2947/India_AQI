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

import { useEffect } from "react";

export function useAccent(
  textColor: string | null,
  fillColor: string | null,
): void {
  useEffect(() => {
    const root = document.documentElement;
    if (!textColor) return;

    root.style.setProperty("--accent", textColor);
    root.style.setProperty("--accent-fill", fillColor ?? textColor);

    return () => {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-fill");
    };
  }, [textColor, fillColor]);
}
