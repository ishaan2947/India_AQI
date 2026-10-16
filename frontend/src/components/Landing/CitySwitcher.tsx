/**
 * The hero's city picker.
 *
 * This started as a transparent native `<select>` laid over the city name —
 * thirty options, keyboard support and the platform dropdown on a phone, all
 * for free. The free part turned out to be a lie: Chrome renders the option
 * list using the *select's own* computed font, and the select was inheriting
 * 36px display type, so clicking the name opened a full-screen white sheet
 * with one enormous blue-highlighted row in it. A control that hands the
 * operating system a blank cheque on styling is not a control we can design.
 *
 * So it is a listbox now, and it owes the native element everything it was
 * actually giving us:
 *
 *   - Enter / Space / ArrowUp / ArrowDown open it, arrows move, Enter picks,
 *     Escape and Tab close and hand focus back to the button.
 *   - Type-ahead: press "d" for Delhi, "ko" for Kochi, same 800ms buffer a
 *     native select uses.
 *   - `role="listbox"` + `aria-activedescendant`, so a screen reader hears
 *     the same thing it heard before.
 *   - Click anywhere outside to dismiss.
 *
 * It prefers to open *upward*, because the reading sits at the bottom of the
 * hero band and a panel dropping down from there would run off the screen.
 * "Prefers", not "always": the first version always opened upward and was
 * absolutely positioned inside the hero, so once the page was scrolled even
 * slightly the top of the panel was clipped by the landing page's scroll
 * container and the first few cities — Agra among them — simply weren't
 * there. It is portalled to the body with fixed positioning now, so no
 * ancestor's overflow can crop it, and it flips below the button when there
 * isn't room above.
 */

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { CITY_IMAGES, preloadCityImage, spriteCell } from "../../data/cityImages";
import type { CityWithLatest } from "../../types";
import { getAQIBand } from "../../utils/aqiHelpers";

const TYPEAHEAD_MS = 800;

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
  const selectedIndex = Math.max(
    0,
    cities.findIndex((c) => c.id === city.id),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef<{ buffer: string; at: number }>({
    buffer: "",
    at: 0,
  });

  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    maxHeight: 352,
    width: 320,
  });

  /**
   * Place the panel against the button in viewport coordinates.
   *
   * Above if it fits, below if it doesn't, and never taller than the space
   * it has — a list that runs off the screen is the same bug in a different
   * direction.
   */
  const reposition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const gap = 12;
    const margin = 16;
    const width = Math.min(320, window.innerWidth - margin * 2);
    const spaceAbove = rect.top - gap - margin;
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const preferAbove = spaceAbove >= Math.min(352, spaceBelow || 0) || spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      180,
      Math.min(352, preferAbove ? spaceAbove : spaceBelow),
    );

    setPosition({
      left: Math.min(
        Math.max(margin, rect.left),
        window.innerWidth - width - margin,
      ),
      top: preferAbove ? rect.top - gap - maxHeight : rect.bottom + gap,
      maxHeight,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // `true` so this also catches the landing page's inner scroll container,
    // which does not bubble its scroll events.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  // Opening moves focus into the list; closing puts it back on the button,
  // but only when the list had it — otherwise a background re-render that
  // closes the panel would yank focus away from whatever the reader is doing.
  useEffect(() => {
    if (open) {
      setActiveIndex(selectedIndex);
      listRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the active option in view when arrowing through thirty cities, and
  // warm its photograph while we are at it: by the time the reader commits,
  // the hero's cross-fade usually has nothing left to wait for.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView({ block: "nearest" });
    const highlighted = cities[activeIndex];
    if (highlighted) preloadCityImage(highlighted.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The panel is portalled, so "inside the component" is two elements.
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const commit = useCallback(
    (index: number) => {
      const next = cities[index];
      if (next) onSelect(next.id);
      setOpen(false);
      buttonRef.current?.focus();
    },
    [cities, onSelect],
  );

  const findByPrefix = (prefix: string, from: number): number => {
    for (let i = 1; i <= cities.length; i++) {
      const idx = (from + i) % cities.length;
      if (cities[idx].name.toLowerCase().startsWith(prefix)) return idx;
    }
    return -1;
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(cities.length - 1, i + 1));
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
        setActiveIndex(cities.length - 1);
        return;
      case "PageDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(cities.length - 1, i + 5));
        return;
      case "PageUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 5));
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        return;
      case "Escape":
        e.preventDefault();
        close();
        return;
      case "Tab":
        close(false);
        return;
      default:
        break;
    }

    if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      const state = typeahead.current;
      state.buffer =
        now - state.at > TYPEAHEAD_MS ? e.key.toLowerCase() : state.buffer + e.key.toLowerCase();
      state.at = now;
      const found = findByPrefix(
        state.buffer,
        state.buffer.length === 1 ? activeIndex : activeIndex - 1,
      );
      if (found >= 0) setActiveIndex(found);
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
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label="Cities"
              aria-activedescendant={optionId(activeIndex)}
              onKeyDown={onListKeyDown}
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
              // Above the masthead's z-index, since the panel can overlap it.
              className="fixed z-[3000] overflow-y-auto overscroll-contain border border-smoke-700 bg-smoke-950 py-1 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
            >
          {cities.map((c, i) => (
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
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * One row, memoised.
 *
 * Thirty rows re-rendering on every arrow key is thirty className strings and
 * thirty inline style objects rebuilt to move a highlight by one place. With
 * `memo` and stable callbacks, a keystroke re-renders the row you left and the
 * row you arrived at.
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
  const cell = CITY_IMAGES[city.name] ? spriteCell(CITY_IMAGES[city.name]) : null;

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
        // 56x38, up from 40x28: the old size was too small to show a
        // cityscape, which reads as blur no matter how many pixels are
        // behind it. The sprite's cells are 2x this.
        className="h-[38px] w-14 shrink-0"
        style={{
          ...(cell ?? { backgroundColor: "#231F1D" }),
          boxShadow: "inset 0 0 0 1px rgba(12,11,10,0.6)",
        }}
      />
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: band.color }} />
      <span
        className={`min-w-0 flex-1 truncate text-body ${
          selected ? "text-smoke-100" : "text-smoke-200"
        }`}
      >
        {city.name}
      </span>
      <span className="shrink-0 text-micro text-smoke-500">{band.label}</span>
      <span
        className="u-figure w-10 shrink-0 text-right text-body"
        style={{ color: band.textColor }}
      >
        {Math.round(aqi)}
      </span>
    </li>
  );
});
