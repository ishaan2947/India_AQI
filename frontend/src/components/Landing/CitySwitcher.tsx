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
 * It opens *upward*: the reading sits at the bottom of the hero band, and a
 * panel dropping down from it would open off the bottom of the screen.
 */

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";

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
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label="Cities"
          aria-activedescendant={optionId(activeIndex)}
          onKeyDown={onListKeyDown}
          className="absolute bottom-full left-0 z-50 mb-3 max-h-[min(22rem,50dvh)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto border border-smoke-700 bg-smoke-950 py-1 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
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
        </ul>
      ) : null}
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
        className="h-7 w-10 shrink-0"
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
