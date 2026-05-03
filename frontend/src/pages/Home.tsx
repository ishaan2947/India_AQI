/**
 * Home page: full-bleed map on the left, live leaderboard on the right.
 */

import { useNavigate } from "react-router-dom";

import AQIMap from "../components/Map/AQIMap";
import Sidebar from "../components/Layout/Sidebar";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "1fr 320px" }}>
      <div className="relative">
        <AQIMap onCitySelect={(id) => navigate(`/cities/${id}`)} />
      </div>
      <Sidebar />
    </div>
  );
}
