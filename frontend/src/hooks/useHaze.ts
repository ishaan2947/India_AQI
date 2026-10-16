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
 * Their product is written as `--haze` on the hero band, which the overlay
 * layers and the photograph's filter read (see index.css). Nothing here
 * touches React state: a scroll-linked effect that re-renders a component
 * tree 60 times a second is how this kind of thing ends up janky.
 *
 * Two details are not optional, both learned from measuring a city swap at 4x
 * CPU throttle, where this hook — not the cross-fade — was dropping frames:
 *
 *   1. **The variables live on the band, not on :root.** A custom property
 *      written to the root element invalidates style for the whole document,
 *      and this page has a thirty-row table, a thirty-dot plot and several
 *      sections' worth of prose hanging off it. Scoped to the band, a write
 *      costs a subtree that is one photograph and three overlays.
 *   2. **The loop stops when there is nothing to do.** Reading the band's
 *      rect forces a synchronous layout; doing that every frame, forever,
 *      while the hero is on screen is a tax on every other interaction on the
 *      page. It now runs only while something is actually changing — the
 *      load-in settle, a scroll, or a city change — and parks itself the
 *      moment it has settled.
 */

import { useEffect, useRef, type RefObject } from "react";

import { usePrefersReducedMotion } from "./useMotionPrefs";

/** How long the load-in settle takes, and how far it goes. */
const INTRO_MS = 1600;
const INTRO_CEILING = 0.6;
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

/** The nearest ancestor that actually scrolls, so we can listen to it. */
function scrollParent(el: HTMLElement): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
    node = node.parentElement;
  }
  return window;
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

  // Survives across loop stops so the haze doesn't snap back when it resumes.
  const appliedRef = useRef(0);
  /** Set by the scroll listener and by a city change; the loop reads it. */
  const wakeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;

    const write = (haze: number, progress: number) => {
      band.style.setProperty("--haze", haze.toFixed(3));
      band.style.setProperty("--haze-p", progress.toFixed(3));
      band.style.setProperty("--haze-filter", filterFor(haze));
    };

    if (reduced) {
      // No loop, no travel: today's air, immediately.
      appliedRef.current = densityRef.current;
      write(densityRef.current, 1);
      wakeRef.current = () => {
        appliedRef.current = densityRef.current;
        write(densityRef.current, 1);
      };
      return () => {
        wakeRef.current = null;
      };
    }

    let raf = 0;
    let startedAt = 0;
    let lastHaze = -1;
    let lastProgress = -1;
    let progress = 0;
    let rectDirty = true;
    let visible = true;

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;

      const introElapsed = clamp01((now - startedAt) / INTRO_MS);
      const intro = easeOutCubic(introElapsed) * INTRO_CEILING;

      // The expensive read, done only when the scroll position may have moved.
      if (rectDirty) {
        progress = bandProgress(band);
        rectDirty = false;
      }
      const effective = Math.max(intro, progress);

      // The density is applied immediately on a city change rather than
      // eased toward. Two reasons, one visual and one about frames: the hero
      // photograph is cross-fading at that exact moment, so the dissolve
      // already supplies the continuity an ease would have provided — and
      // animating the filter *during* the fade rewrites it 60 times, which
      // re-rasterises both layers on every one of those frames.
      appliedRef.current = densityRef.current;

      const haze = appliedRef.current * effective;
      if (
        Math.abs(haze - lastHaze) > EPSILON ||
        Math.abs(effective - lastProgress) > EPSILON
      ) {
        write(haze, effective);
        lastHaze = haze;
        lastProgress = effective;
      }

      // Park as soon as everything has arrived. Anything that can change the
      // answer — a scroll, a new city — wakes it again.
      const busy = introElapsed < 1 || rectDirty;
      if (!busy) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!raf && visible) raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onScroll = () => {
      rectDirty = true;
      start();
    };
    wakeRef.current = onScroll;

    const scroller = scrollParent(band);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    // Only animate while the band is on screen. Once the reader is down in
    // the rankings the haze is pinned at full anyway.
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          visible = entries.some((e) => e.isIntersecting);
          if (visible) {
            rectDirty = true;
            start();
          } else {
            stop();
          }
        },
        { threshold: 0 },
      );
      io.observe(band);
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        rectDirty = true;
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();

    return () => {
      stop();
      io?.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      wakeRef.current = null;
      band.style.removeProperty("--haze");
      band.style.removeProperty("--haze-p");
      band.style.removeProperty("--haze-filter");
    };
  }, [reduced, bandRef]);

  // A new city means a new target density, which means the parked loop has
  // work to do again.
  useEffect(() => {
    wakeRef.current?.();
  }, [density]);
}
