/**
 * TypeScript types mirroring the Pydantic schemas exposed by the backend.
 *
 * Keep these in sync with `backend/schemas.py` whenever the API changes.
 */

export interface City {
  id: number;
  name: string;
  state: string;
  lat: number;
  lng: number;
  created_at: string;
}

export interface CityWithLatest extends City {
  latest_aqi: number | null;
  latest_pm25: number | null;
  latest_timestamp: string | null;
  latest_source: string | null;
}

export interface AQIReading {
  id: number;
  city_id: number;
  aqi_value: number;
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  timestamp: string;
  source: string;
}

export interface PredictionPoint {
  prediction_for: string;
  predicted_aqi: number;
  confidence_score: number;
}

export interface PredictionResponse {
  city_id: number;
  city_name: string;
  generated_at: string;
  horizon_hours: number;
  points: PredictionPoint[];
}

export interface AllPredictionsResponse {
  generated_at: string;
  predictions: PredictionResponse[];
}

export interface StatsCityEntry {
  city_id: number;
  city_name: string;
  state: string;
  aqi_value: number;
  pm25: number | null;
  timestamp: string;
}

export interface StatsResponse {
  label: string;
  entries: StatsCityEntry[];
}

/**
 * CPCB (Central Pollution Control Board) band keys — the scale India
 * actually publishes against. See DESIGN.md §3.2 for why these replaced the
 * US EPA bands, and for the provenance caveat about WAQI's numbers.
 */
export type AQICategoryKey =
  | "good"
  | "satisfactory"
  | "moderate"
  | "poor"
  | "veryPoor"
  | "severe";

export interface AQICategory {
  key: AQICategoryKey;
  /** CPCB's own name for the band, e.g. "Very poor". */
  label: string;
  /** One short imperative: what to do about it today. */
  verdict: string;
  description: string;
  /** Fill colour — areas, bars, dots, rules. */
  color: string;
  /** Lightened variant for when the band colour has to carry glyphs. */
  textColor: string;
  min: number;
  max: number;
}
