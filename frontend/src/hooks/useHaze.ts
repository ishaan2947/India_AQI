/**
 * The haze: the one piece of motion the whole design hangs on.
 *
 * Two numbers multiply together.
 *
 *   density   0..1, from the AQI of the city in the hero. This is the *real*
 *             value — how washed out the photograph should end up.
 *   progress  0..1, how far the reader has scrolled through the hero band,
 *             with a floor that eases up to 0.6 on load so a visitor who
 *             never scrolls still sees today's air rather than a clean frame.
 *
 * Their product is written to `--haze` on the root element, which the overlay
 * layers and the photograph's filter read (see index.css). Nothing here
 * touches React state: a scroll-linked effect that re-renders a component
 * tree 60 times a second is how this kind of thing ends up janky.
 *
 * One rAF loop, running only while the band is actually on screen and the tab
 * is visible, writing at most three custom properties per frame and skipping
 * the write entirely when the value has not meaningfully moved. Under
 * `prefers-reduced-motion` there is no loop at all — the haze is set straight
 * to today's density, so the information survives and only the travel is lost.
 */

import { useEffect, useRef, type RefObject } from "react";

import { usePrefersReducedMotion } from "./useMotionPrefs";

/** How long the load-in settle takes, and how far it goes. */
const INTRO_MS = 1600;
const INTRO_CEILING = 0.6;
/** Per-frame approach rate when the reader switches city. */
const LERP = 0.12;
/** Don't bother rewriting for changes smaller than this. */
const EPSILON = 0.004;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * What smog does to a photograph, as a filter chain: colour drains, contrast
 * collapses, the whole frame lifts toward a flat warm grey, and detail at
 * distance goes soft. Blur is last and small — above about 1.2px it stops
 * reading as atmosphere and starts reading as a lens problem.
 */
function filterFor(haze: number): string {
  if (haze <= 0.005) return "none";
  return [
    `saturate(${(1 - 0.6 * haze).toFixed(3)})`,
    `contrast(${(1 - 0.24 * haze).toFixed(3)})`,
    `brightness(${(1 + 0.06 * haze).toFixed(3)})`,
    `sepia(${(0.3 * haze).toFixed(3)})`,
    `blur(${(1.15 * haze).toFixed(2)}px)`,
  ].join(" ");
}

function bandProgress(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  // Rect is viewport-relative, so this works whether the page scrolls or an
  // inner container does — which matters here, because the app shell keeps
  // its own scroll container.
  const travel = Math.max(1, rect.height * 0.7);
  return clamp01(-rect.top / travel);
}

export function useHaze(
  bandRef: RefObject<HTMLElement | null>,
  density: number,
): void {
  const reduced = usePrefersReducedMotion();

  // Read inside the frame loop rather than closed over, so switching city
  // doesn't restart the animation.
  const densityRef = useRef(density);
  densityRef.current = density;

  // Survives across loop stops (tab hidden, band scrolled away) so the haze
  // doesn't snap back to clean when the loop resumes.
  const appliedRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;

    const write = (haze: number, progress: number) => {
      root.style.setProperty("--haze", haze.toFixed(3));
      root.style.setProperty("--haze-p", progress.toFixed(3));
      root.style.setProperty("--haze-filter", filterFor(haze));
    };

    if (reduced) {
      // No loop, no travel: today's air, immediately.
      appliedRef.current = densityRef.current;
      write(densityRef.current, 1);
      return () => {
        root.style.removeProperty("--haze");
        root.style.removeProperty("--haze-p");
        root.style.removeProperty("--haze-filter");
      };
    }

    const band = bandRef.current;
    let raf = 0;
    let startedAt = 0;
    let lastHaze = -1;
    let lastProgress = -1;

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;

      const intro =
        easeOutCubic(clamp01((now - startedAt) / INTRO_MS)) * INTRO_CEILING;
      const scrolled = band ? bandProgress(band) : 1;
      const progress = Math.max(intro, scrolled);

      // Ease the density itself, so changing city is a settle rather than a
      // jump cut. Scroll progress is applied directly — lagging the reader's
      // own scroll by a few frames feels broken, not smooth.
      appliedRef.current += (densityRef.current - appliedRef.current) * LERP;

      const haze = appliedRef.current * progress;
      if (
        Math.abs(haze - lastHaze) > EPSILON ||
        Math.abs(progress - lastProgress) > EPSILON
      ) {
        write(haze, progress);
        lastHaze = haze;
        lastProgress = progress;
      }

      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // Only animate while the band is on screen. Once the reader is down in
    // the rankings the haze is pinned at full anyway.
    let io: IntersectionObserver | null = null;
    if (band && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) start();
          else stop();
        },
        { threshold: 0 },
      );
      io.observe(band);
    } else {
      start();
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.style.removeProperty("--haze");
      root.style.removeProperty("--haze-p");
      root.style.removeProperty("--haze-filter");
    };
  }, [reduced, bandRef]);

  // Reduced motion has no loop to pick the new value up, so it needs an
  // explicit write when the reader switches city.
  useEffect(() => {
    if (!reduced) return;
    const root = document.documentElement;
    root.style.setProperty("--haze", density.toFixed(3));
    root.style.setProperty("--haze-p", "1");
    root.style.setProperty("--haze-filter", filterFor(density));
  }, [reduced, density]);
}
