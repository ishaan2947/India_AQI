import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Navbar from "./components/Layout/Navbar";
import CityDetail from "./pages/CityDetail";
import Home from "./pages/Home";
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
      <div className="h-screen w-screen flex flex-col bg-ink-900">
        <Navbar />
        <main className="flex-1 min-h-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cities/:cityId" element={<CityDetail />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
