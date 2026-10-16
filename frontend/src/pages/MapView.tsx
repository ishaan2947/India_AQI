/**
 * Map view (/map): full-bleed map + live leaderboard.
 *
 * This was the home page until the landing page took over `/`.
 *
 * Mobile: stacks vertically — map ~55vh on top, leaderboard scrolls below.
 * Desktop (>= md): side-by-side with a fixed 320px sidebar column.
 *
 * Marker interactions are handled inside the map component itself (fly-to
 * + popup with a "View detail" link), so this page is purely composition.
 */

import AQIMap from "../components/Map/AQIMap";
import Sidebar from "../components/Layout/Sidebar";

export default function MapView() {
  return (
    <div className="grid h-full grid-rows-[52dvh_1fr] md:grid-cols-[1fr_20rem] md:grid-rows-1">
      {/* The map is the page, so there is nothing to put a visible heading on
          — but a document with no h1 is a document a screen reader can't
          summarise. */}
      <h1 className="sr-only">
        Live air quality across thirty Indian cities, mapped
      </h1>
      <div className="relative min-h-0">
        <AQIMap />
      </div>
      <div className="min-h-0 overflow-hidden">
        <Sidebar />
      </div>
    </div>
  );
}
