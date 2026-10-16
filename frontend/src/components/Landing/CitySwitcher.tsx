/**
 * The hero's city picker.
 *
 * Its history is a list of bug reports, and each one is worth keeping:
 *
 *   1. It began as a transparent native `<select>` over the city name.
 *      Chrome renders the option list in the *select's* computed font, and
 *      this select inherited 36px display type, so clicking the name opened a
 *      full-screen white sheet. A control that hands the operating system a
 *      blank cheque on styling is not a control we can design.
 *   2. As a listbox it opened upward and was absolutely positioned inside the
 *      hero, so once the page scrolled, the top of the panel was clipped by
 *      the landing page's scroll container and the first cities vanished. It
 *      is portalled to the body and fixed-positioned now, and flips below the
 *      button when there is no room above.
 *   3. Reopening scrolled to the *selected* city — which is what a native
 *      select does — and with seven of thirty rows visible, picking Delhi put
 *      Agra somewhere above the top edge, where it read as missing.
 *
 * (3) is why there is a filter box. Thirty is the size at which scroll
 * position stops being the answer and typing starts being it: "agr" lands on
 * Agra from anywhere in the list. It also makes the type-ahead that was
 * already here discoverable rather than secret, and it lets the list open at
 * the top and stay there, because finding a city no longer depends on where
 * the scroll happens to be.
 *
 * It is a combobox in the ARIA sense: the input holds focus and announces the
 * active option via `aria-activedescendant`, the list itself is never
 * focused, and every key the pattern expects is handled.
 */

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  CITY_IMAGES,
  preloadCityImage,
  spriteCell,
} from "../../data/cityImages";
import type { CityWithLatest } from "../../types";
import { getAQIBand } from "../../utils/aqiHelpers";

export default function CitySwitcher({
  city,
  cities,
  onSelect,
}: {
  city: CityWithLatest;
  cities: CityWithLatest[];
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    // Name matches first, then state — people reach for a region ("kerala",
    // "guj") about as often as they reach for a city.
    const byName = cities.filter((c) => c.name.toLowerCase().includes(q));
    const byState = cities.filter(
      (c) =>
        !c.name.toLowerCase().includes(q) && c.state.toLowerCase().includes(q),
    );
    return [...byName, ...byState];
  }, [cities, query]);

  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    maxHeight: 420,
    width: 340,
  });

  /**
   * Place the panel against the button in viewport coordinates: above if it
   * fits, below if it doesn't, never taller than the space it has.
   */
  const reposition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const gap = 12;
    const margin = 16;
    const ideal = 420;
    const width = Math.min(340, window.innerWidth - margin * 2);
    const spaceAbove = rect.top - gap - margin;
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const above =
      spaceAbove >= Math.min(ideal, spaceBelow) || spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      220,
      Math.min(ideal, above ? spaceAbove : spaceBelow),
    );

    setPosition({
      left: Math.min(
        Math.max(margin, rect.left),
        window.innerWidth - width - margin,
      ),
      top: above ? rect.top - gap - maxHeight : rect.bottom + gap,
      maxHeight,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // Capture phase, so this also sees the landing page's inner scroll
    // container, whose scroll events never reach window. Scrolling *inside*
    // the list doesn't move the button, so it doesn't need a recalculation.
    const onAnyScroll = (e: Event) => {
      if (e.target === listRef.current) return;
      reposition();
    };
    window.addEventListener("scroll", onAnyScroll, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", onAnyScroll, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  // Opening starts clean: empty query, list at the top, current city
  // highlighted. Focus goes to the input, because typing is the fast path
  // through thirty options.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const index = cities.findIndex((c) => c.id === city.id);
    setActiveIndex(Math.max(0, index));
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A new query re-ranks everything, so the highlight returns to the top.
  useEffect(() => {
    if (query) setActiveIndex(0);
  }, [query]);

  // Keep the highlight in view, and warm its photograph while we are here.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView({ block: "nearest" });
    const highlighted = matches[activeIndex];
    if (highlighted) preloadCityImage(highlighted.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex, matches]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The panel is portalled, so "inside this component" is two subtrees.
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const next = matches[index];
      if (next) onSelect(next.id);
      close();
    },
    [matches, onSelect, close],
  );

  /** Tells the reader the list continues past the edge of the panel. */
  const syncEdges = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setEdges({
      top: el.scrollTop > 2,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2,
    });
  }, []);

  useEffect(() => {
    if (open) syncEdges();
  }, [open, matches, syncEdges]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(matches.length - 1, i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        e.preventDefault();
        setActiveIndex(matches.length - 1);
        return;
      case "PageDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(matches.length - 1, i + 5));
        return;
      case "PageUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 5));
        return;
      case "Enter":
        e.preventDefault();
        commit(activeIndex);
        return;
      case "Escape":
        e.preventDefault();
        // Clears the query on the first press and closes on the second,
        // which is what every search field does.
        if (query) setQuery("");
        else close();
        return;
      case "Tab":
        close(false);
        return;
      default:
        return;
    }
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Showing ${city.name}. Choose another city.`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="group inline-flex items-baseline gap-1.5 border-b border-smoke-500/70 pb-0.5 text-head font-semibold text-smoke-100 transition-colors duration-tap ease-air hover:border-[color:var(--accent)]"
      >
        {city.name}
        <svg
          aria-hidden
          viewBox="0 0 10 6"
          className={`h-[0.3em] w-[0.5em] self-center fill-none stroke-smoke-300 stroke-[1.5] transition-transform duration-move ease-air ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
              // Above the masthead, which the panel can overlap.
              className="fixed z-[3000] flex flex-col border border-smoke-700 bg-smoke-950 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-smoke-800 px-3 py-2.5">
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5 shrink-0 fill-none stroke-smoke-500 stroke-[1.5]"
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="M11 11l4 4" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    matches.length > 0 ? optionId(activeIndex) : undefined
                  }
                  aria-label="Filter cities by name or state"
                  placeholder="Type a city or state…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  className="w-full bg-transparent text-body text-smoke-100 placeholder:text-smoke-500 focus:outline-none"
                />
                {query ? (
                  <span className="shrink-0 text-micro text-smoke-500 tnum">
                    {matches.length}
                  </span>
                ) : null}
              </div>

              {/* A flex column, not a block: the list below sizes itself by
                  flexing, because a percentage height resolves against a
                  parent's *specified* height and this one's is auto. With
                  `h-full` the list measured 1857px inside a 369px box — it
                  overflowed its parent instead of scrolling inside itself,
                  and the panel stopped being scrollable at all. */}
              <div className="relative flex min-h-0 flex-auto flex-col">
                {/* Edge fades: the honest way to say "there is more" when the
                    scrollbar is a hairline. */}
                {edges.top ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-smoke-950 to-transparent"
                  />
                ) : null}
                {edges.bottom ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-smoke-950 to-transparent"
                  />
                ) : null}

                <ul
                  ref={listRef}
                  id={listId}
                  role="listbox"
                  aria-label="Cities"
                  onScroll={syncEdges}
                  // flex-auto, not flex-1: with `flex: 1 1 0%` the
                  // hypothetical size is zero, so a *short* list would
                  // collapse the panel to its header. `auto` takes the
                  // content height, which the max-height then shrinks when
                  // there are thirty of them.
                  className="min-h-0 flex-auto overflow-y-auto overscroll-contain py-1"
                >
                  {matches.map((c, i) => (
                    <CityOption
                      key={c.id}
                      id={optionId(i)}
                      city={c}
                      index={i}
                      active={i === activeIndex}
                      selected={c.id === city.id}
                      onHover={setActiveIndex}
                      onPick={commit}
                    />
                  ))}

                  {matches.length === 0 ? (
                    <li className="px-3 py-8 text-center text-micro text-smoke-500">
                      Nothing matches &ldquo;{query}&rdquo;.
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * One row, memoised.
 *
 * Thirty rows re-rendering on every keystroke is thirty className strings and
 * thirty style objects rebuilt to move a highlight one place. With `memo` and
 * stable callbacks, a keystroke re-renders the row you left and the row you
 * arrived at.
 */
const CityOption = memo(function CityOption({
  id,
  city,
  index,
  active,
  selected,
  onHover,
  onPick,
}: {
  id: string;
  city: CityWithLatest;
  index: number;
  active: boolean;
  selected: boolean;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
}) {
  const aqi = city.latest_aqi ?? 0;
  const band = getAQIBand(aqi);
  const cell = CITY_IMAGES[city.name]
    ? spriteCell(CITY_IMAGES[city.name])
    : null;

  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onMouseEnter={() => onHover(index)}
      onClick={() => onPick(index)}
      className={`flex cursor-pointer items-center gap-3 border-l-2 px-3 py-2 transition-colors duration-tap ease-air ${
        active ? "bg-smoke-850" : "bg-transparent"
      } ${selected ? "border-l-[color:var(--accent)]" : "border-l-transparent"}`}
    >
      <span
        aria-hidden
        className="h-[38px] w-14 shrink-0"
        style={{
          ...(cell ?? { backgroundColor: "#231F1D" }),
          boxShadow: "inset 0 0 0 1px rgba(12,11,10,0.6)",
        }}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-body ${
            selected ? "text-smoke-100" : "text-smoke-200"
          }`}
        >
          {city.name}
        </span>
        <span className="block truncate text-micro text-smoke-500">
          {city.state}
        </span>
      </span>
      <span
        className="u-figure w-10 shrink-0 text-right text-body"
        style={{ color: band.textColor }}
      >
        {Math.round(aqi)}
      </span>
    </li>
  );
});
