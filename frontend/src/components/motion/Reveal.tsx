/**
 * Scroll reveals. One hook, two components, four rules.
 *
 * The rules (DESIGN.md §6) are what keep this from reading as decoration:
 *
 *   1. It fires **once**. The observer disconnects on first intersection, so
 *      nothing re-animates on the way back up — re-triggering is what makes
 *      the pattern feel cheap.
 *   2. Travel is 14px. Far enough to read as motion, short enough that the
 *      layout never looks like it is assembling itself.
 *   3. Words stagger at 34ms and the stagger is capped, so a long sentence
 *      finishes arriving instead of crawling across the screen.
 *   4. Reduced motion, or no IntersectionObserver, means the content is
 *      simply *there*. The failure mode is never "content never appears".
 */

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../../hooks/useMotionPrefs";

const STAGGER_MS = 34;
const MAX_STAGGERED_WORDS = 14;

export function useReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      // Held back from the bottom edge so a block starts moving just after
      // it clears the fold rather than the instant it touches it.
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return {
    ref,
    shown,
    style: { transitionDelay: shown && !reduced ? `${delay}ms` : "0ms" },
    className: `transition-[opacity,transform] duration-enter ease-air ${
      shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[14px]"
    }`,
  };
}

/** Fades a block up the first time it scrolls into view. */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reveal = useReveal<HTMLDivElement>(delay);
  return (
    <div
      ref={reveal.ref}
      style={reveal.style}
      className={`${reveal.className} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The words-arrive-as-you-scroll effect, kept from the previous design and
 * given a job: it is reserved for the *lead* line of a section, so the
 * sentence that frames the data is the thing that assembles itself. Body
 * prose fades as a block — animating every paragraph word-by-word would turn
 * reading into waiting.
 *
 * Accessibility: the whole string stays in the accessible tree as one label
 * and the per-word spans are hidden from it, so a screen reader hears a
 * sentence rather than a list of words.
 */
export function RevealWords({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const words = text.split(" ");

  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => (
        // The space sits outside the clipping wrapper: inside it,
        // overflow-hidden eats the space and the sentence arrives as
        // onelongword.
        <span key={`${word}-${i}`} aria-hidden>
          <span className="inline-block overflow-hidden align-bottom">
            <span
              className={`inline-block transition-[opacity,transform] duration-enter ease-air ${
                shown
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-[0.5em]"
              }`}
              style={{
                transitionDelay:
                  shown && !reduced
                    ? `${delay + Math.min(i, MAX_STAGGERED_WORDS) * STAGGER_MS}ms`
                    : "0ms",
              }}
            >
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
