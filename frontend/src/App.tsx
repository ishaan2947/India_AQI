import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Navbar from "./components/Layout/Navbar";
import CityDetail from "./pages/CityDetail";
import Home from "./pages/Home";
import Predictions from "./pages/Predictions";

export default function App() {
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
