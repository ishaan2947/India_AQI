/**
 * Home page: full-bleed map on the left, live leaderboard on the right.
 *
 * Marker interactions are handled inside the map component itself (fly-to
 * + popup with a "View detail" link), so this page is purely composition.
 */

import AQIMap from "../components/Map/AQIMap";
import Sidebar from "../components/Layout/Sidebar";

export default function Home() {
  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "1fr 320px" }}>
      <div className="relative">
        <AQIMap />
      </div>
      <Sidebar />
    </div>
  );
}
