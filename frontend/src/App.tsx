import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import Footer from "./components/Layout/Footer";
import Navbar from "./components/Layout/Navbar";
import CityDetail from "./pages/CityDetail";
import HowItWorks from "./pages/HowItWorks";
import Landing from "./pages/Landing";
import MapView from "./pages/MapView";
import Predictions from "./pages/Predictions";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

// Free-tier Render sleeps after 15 min idle; first request takes ~30 s to wake.
// Fire a fire-and-forget ping the moment the app loads so by the time the user
// clicks anywhere, the backend is already awake.
function warmUpBackend(): void {
  const healthUrl = API_BASE.replace(/\/api\/?$/, "") + "/healthz";
  fetch(healthUrl, { method: "GET", keepalive: true }).catch(() => {
    /* swallow — warm-up is best-effort */
  });
}

export default function App() {
  useEffect(() => {
    warmUpBackend();
  }, []);

  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

function Shell() {
  const { pathname } = useLocation();

  // The editorial pages end with their own colophon, so the slim app-shell
  // footer would be a second ending pinned under the first. The fixed-height
  // app pages (map especially) still need it, because they have nowhere else
  // to put attribution.
  const showFooter = pathname !== "/" && pathname !== "/how-it-works";

  return (
    <div className="flex h-dvh w-full flex-col bg-smoke-950">
      <Navbar />
      <main className="min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/cities/:cityId" element={<CityDetail />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          {/* The old /about path used to redirect to the landing page, which
              carried the technical copy. That copy now lives on its own
              page, so send bookmarks there instead of 404ing them. */}
          <Route
            path="/about"
            element={<Navigate to="/how-it-works" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showFooter ? <Footer /> : null}
    </div>
  );
}
