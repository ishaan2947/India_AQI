/**
 * Thirty cities, twenty-four hours, seven hundred and twenty cells.
 *
 * The forecasts page used to be a 4-across grid of cards, each showing one
 * city's number and an arrow. Thirty cards is thirty separate readings the
 * reader has to hold in their head to answer the only question the page is
 * for: *where and when is the air bad tomorrow?*
 *
 * A heatmap answers it in one object. Cities down, the next twenty-four
 * hours across, every cell painted by CPCB band — the Indo-Gangetic cities
 * come out as a dark horizontal stripe, the overnight build-up as a vertical
 * one, and the two together are the shape of an Indian winter night. No card
 * grid can show that, and neither can thirty sparklines.
 *
 * Built as a real `<table>`: the rows are cities, the columns are hours, and
 * the headers say so. Screen readers get a navigable table with values in
 * every cell; everyone else gets the picture. The hover readout is a single
 * line above the grid rather than a floating tooltip, because a bubble that
 * follows the cursor across a dense grid covers the thing being compared.
 */

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { AllPredictionsResponse, CityWithLatest } from "../../types";
import {
  formatISTHourLabel,
  getAQIBand,
  getISTHour,
} from "../../utils/aqiHelpers";

export type SortKey = "peak" | "now" | "change";

interface Row {
  cityId: number;
  city: string;
  state: string;
  now: number | null;
  peak: number;
  peakAt: string;
  change: number | null;
  cells: Array<{ at: string; aqi: number }>;
}

export function buildRows(
  predictions: AllPredictionsResponse | null,
  cities: CityWithLatest[] | null,
): Row[] {
  if (!predictions) return [];
  const byId = new Map((cities ?? []).map((c) => [c.id, c]));

  return predictions.predictions
    .filter((p) => p.points.length > 0)
    .map((p) => {
      const city = byId.get(p.city_id);
      const now = city?.latest_aqi ?? null;
      const cells = p.points.map((pt) => ({
        at: pt.prediction_for,
        aqi: pt.predicted_aqi,
      }));
      const peakCell = cells.reduce((a, b) => (b.aqi > a.aqi ? b : a));
      const last = cells[cells.length - 1].aqi;
      return {
        cityId: p.city_id,
        city: p.city_name,
        state: city?.state ?? "",
        now,
        peak: peakCell.aqi,
        peakAt: peakCell.at,
        change: now != null ? last - now : null,
        cells,
      };
    });
}

export function sortRows(rows: Row[], key: SortKey): Row[] {
  const sorted = rows.slice();
  switch (key) {
    case "now":
      return sorted.sort((a, b) => (b.now ?? -1) - (a.now ?? -1));
    case "change":
      return sorted.sort((a, b) => (b.change ?? -999) - (a.change ?? -999));
    case "peak":
    default:
      return sorted.sort((a, b) => b.peak - a.peak);
  }
}

export default function ForecastGrid({
  rows,
  pendingCities,
  loading,
  error,
}: {
  rows: Row[];
  /** City names from /aqi/current, which lands instantly — used to draw the
      real grid while the much slower forecast bundle is still in flight. */
  pendingCities: string[];
  loading: boolean;
  error: string | null;
}) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<{
    city: string;
    hour: string;
    aqi: number;
  } | null>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const hours = rows[0]?.cells ?? [];

  // Event delegation: 720 cells with their own listeners is 720 closures to
  // allocate on every render, and the data needed is three attributes.
  const onPointer = (e: React.MouseEvent | React.FocusEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-aqi]");
    if (!cell) return;
    setHover({
      city: cell.dataset.city ?? "",
      hour: cell.dataset.hour ?? "",
      aqi: Number(cell.dataset.aqi),
    });
  };

  if (error && rows.length === 0) {
    return (
      <div className="border-t border-smoke-800 py-10">
        <p className="font-serif text-lead text-smoke-100">
          The forecast is unavailable.
        </p>
        <p className="u-prose mt-2 max-w-prose">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    // The grid's shape is known before its contents are: the city list is
    // already on screen elsewhere, so draw the real rows and let the cells
    // fill in. A skeleton that matches the layout it replaces is the
    // difference between "loading" and "broken".
    const names = pendingCities.length > 0 ? pendingCities : Array(12).fill("");
    return (
      <div className="border-t border-smoke-800 pt-3">
        <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-0">
          <tbody>
            {names.slice(0, 16).map((name, i) => (
              <tr key={name || i}>
                <td className="w-[7.5rem] py-[3px] pr-3 text-micro text-smoke-500 sm:w-[11rem] sm:text-body">
                  {name || <span className="skeleton block h-3 w-20" />}
                </td>
                <td className="py-[3px]">
                  <span
                    className="skeleton block h-4 w-full"
                    style={{ animationDelay: `${(i % 8) * 90}ms` }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pt-5 font-serif text-body text-smoke-300">
          {loading
            ? "Forecasting thirty cities — 720 recursive predictions, a few seconds."
            : "No forecast available yet."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* One readout, pinned above the grid. A tooltip that follows the
          cursor would cover the cells either side of the one being read —
          exactly the comparison the reader is making. */}
      <div className="flex h-7 items-baseline gap-3 border-b border-smoke-800 pb-1.5">
        {hover ? (
          <>
            <span className="text-body font-semibold text-smoke-100">
              {hover.city}
            </span>
            <span className="u-label text-smoke-500">{hover.hour} IST</span>
            <span
              className="u-figure ml-auto text-row"
              style={{ color: getAQIBand(hover.aqi).textColor }}
            >
              {Math.round(hover.aqi)}
            </span>
            <span className="u-label w-24 text-right text-smoke-300">
              {getAQIBand(hover.aqi).label}
            </span>
          </>
        ) : (
          <span className="u-label text-smoke-500">
            Hover or tab a cell for the hour-by-hour value
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[34rem] table-fixed border-separate border-spacing-0"
          onMouseOver={onPointer}
          onFocus={onPointer}
          onMouseLeave={() => setHover(null)}
        >
          <caption className="sr-only">
            Predicted air quality index for the next 24 hours, by city and
            hour (India Standard Time). Rows are cities; columns are hours.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="u-label sticky left-0 z-10 w-[6.5rem] bg-smoke-950 pb-2 text-left text-smoke-500 sm:w-[11rem]"
              >
                City
              </th>
              {hours.map((h, i) => {
                const hour = getISTHour(h.at);
                const show = hour != null && hour % 6 === 0;
                return (
                  <th
                    key={h.at}
                    scope="col"
                    className="pb-2 text-left align-bottom text-[10px] font-normal text-smoke-500 tnum"
                  >
                    {/* Only every sixth hour is labelled; at 24 columns on a
                        phone there is room for four labels, not twenty-four. */}
                    <span className={show ? "" : "sr-only"}>
                      {show ? String(hour).padStart(2, "0") : formatISTHourLabel(h.at)}
                    </span>
                    {i === 0 ? <span className="sr-only"> IST</span> : null}
                  </th>
                );
              })}
              <th scope="col" className="u-label w-12 pb-2 text-right text-smoke-500">
                Peak
              </th>
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {rows.map((row) => (
              <tr
                key={row.cityId}
                className="group cursor-pointer"
                onClick={() => navigate(`/cities/${row.cityId}`)}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-smoke-950 py-[2px] pr-3 text-left align-middle font-normal"
                >
                  <a
                    href={`/cities/${row.cityId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/cities/${row.cityId}`);
                    }}
                    className="block truncate text-[0.72rem] leading-none text-smoke-200 transition-colors duration-tap ease-air group-hover:text-smoke-100 sm:text-[0.8rem]"
                  >
                    {row.city}
                  </a>
                </th>

                {row.cells.map((cell) => {
                  const band = getAQIBand(cell.aqi);
                  const hour = getISTHour(cell.at);
                  const midnight = hour === 0;
                  // Once per cell, not three times: this string is wanted by
                  // the dataset, the title and the screen-reader text, and
                  // across 720 cells the difference is measurable.
                  const label = formatISTHourLabel(cell.at);
                  const value = Math.round(cell.aqi);
                  return (
                    <td
                      key={cell.at}
                      data-aqi={cell.aqi}
                      data-city={row.city}
                      data-hour={label}
                      tabIndex={-1}
                      title={`${row.city} ${label} IST — AQI ${value}, ${band.label}`}
                      // The day boundary gets a hairline, so "overnight" is
                      // visible as a place on the grid rather than something
                      // the reader has to work out from the axis.
                      className={`h-[14px] py-[2px] sm:h-4 ${midnight ? "border-l border-smoke-600" : ""}`}
                    >
                      <span
                        className="block h-full w-full transition-opacity duration-tap ease-air group-hover:opacity-100"
                        style={{ background: band.color, opacity: 0.88 }}
                      >
                        <span className="sr-only">
                          {value} at {label}
                        </span>
                      </span>
                    </td>
                  );
                })}

                <td className="py-[2px] pl-3 text-right">
                  <span
                    className="u-figure text-[0.72rem] sm:text-[0.8rem]"
                    style={{ color: getAQIBand(row.peak).textColor }}
                  >
                    {Math.round(row.peak)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
