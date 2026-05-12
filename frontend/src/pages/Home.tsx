/**
 * Home page: full-bleed map + live leaderboard.
 *
 * Mobile: stacks vertically — map ~55vh on top, leaderboard scrolls below.
 * Desktop (>= md): side-by-side with a fixed 320px sidebar column.
 *
 * Marker interactions are handled inside the map component itself (fly-to
 * + popup with a "View detail" link), so this page is purely composition.
 */

import AQIMap from "../components/Map/AQIMap";
import Sidebar from "../components/Layout/Sidebar";

export default function Home() {
  return (
    <div
      className="h-full grid md:grid-cols-[1fr_320px]"
      style={{ gridTemplateRows: undefined }}
    >
      <div className="relative h-[55vh] md:h-full">
        <AQIMap />
      </div>
      <div className="min-h-0 overflow-hidden">
        <Sidebar />
      </div>
    </div>
  );
}
