/**
 * Does this visitor want motion?
 *
 * Read once at mount and then live — people do toggle the OS setting mid
 * session, and a stale `matchMedia` result means the page keeps animating at
 * someone who just asked it to stop.
 *
 * Returns `true` for reduced motion. Engines without matchMedia fall through
 * to `false`, which is the right default: motion on, because nothing on this
 * site hides information behind an animation.
 */

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.(QUERY).matches ?? false,
  );

  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
