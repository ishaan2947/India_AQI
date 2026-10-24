/**
 * Two motions for data that is already in the DOM on the first frame.
 *
 * `Reveal` next door answers "this block just scrolled into view" and takes
 * the full 680ms enter duration to do it. Neither half of that fits what the
 * seeded pages need:
 *
 *   - The city masthead and the forecast grid are painted from the snapshot
 *     baked into the bundle, so they are present before the viewport has
 *     settled. There is no intersection to wait for, and a 680ms fade on
 *     content the page already has would spend the speed we just bought
 *     making the page feel slower than it is.
 *
 *   - When the live call lands a few hundred milliseconds later and the
 *     number is different, swapping it silently is worse than not animating
 *     at all: the reader looks back at a figure they have already read and
 *     finds it changed, with nothing having told them so.
 *
 * So: `useArrive` is the shorter gesture for first paint — 320ms, 8px, same
 * curve — and `useSettle` is the acknowledgement that a value was corrected.
 * Both obey prefers-reduced-motion by doing nothing at all, and in both cases
 * the failure mode is content that is simply *there*, never content that
 * never appears.
 *
 * See DESIGN.md §6.
 */

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../../hooks/useMotionPrefs";

/**
 * Fade-and-rise for content present at first paint.
 *
 * Returns props to spread onto an element you are already rendering, so a
 * masthead can be staggered without wrapping every line in a new div.
 */
export function useArrive(delay = 0) {
  const reduced = usePrefersReducedMotion();
  // Initialised from the preference rather than defaulting to hidden, so a
  // reader who has asked for no motion never gets the one-frame flash of
  // opacity-0 that a mount effect would leave behind.
  const [shown, setShown] = useState(() => reduced);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    // Two frames: the first commits the opacity-0 start state, the second
    // changes it. Collapsing them into one would let the browser coalesce
    // both values into a single style recalculation and skip the tween.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [reduced]);

  return {
    style: { transitionDelay: shown && !reduced ? `${delay}ms` : "0ms" },
    className: `transition-[opacity,transform] duration-move ease-air ${
      shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[8px]"
    }`,
  };
}

/** The component form, for when a wrapper is wanted anyway. */
export function Arrive({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const arrive = useArrive(delay);
  return (
    <div style={arrive.style} className={`${arrive.className} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Acknowledge that a displayed value has been replaced.
 *
 * Dips to 30% with no transition, then eases back to full over the move
 * duration — the figure reads as having been re-measured rather than having
 * quietly changed behind the reader's back. Nothing moves, so a number set in
 * tabular figures neither reflows nor shifts the line it sits on.
 *
 * Does nothing on first paint: arrival is `useArrive`'s job, and firing both
 * at once would read as a stutter. Pass the smallest thing that identifies
 * the value — the rounded number, not the object that holds it — or every
 * poll that returns an equal reading will flicker for no reason.
 */
export function useSettle(value: unknown): string {
  const reduced = usePrefersReducedMotion();
  const [dipped, setDipped] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    if (reduced) return;

    setDipped(true);
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setDipped(false));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [value, reduced]);

  return dipped
    ? "opacity-30"
    : "opacity-100 transition-opacity duration-move ease-air";
}
