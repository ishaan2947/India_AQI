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

export type AQICategoryKey =
  | "good"
  | "moderate"
  | "sensitive"
  | "unhealthy"
  | "veryUnhealthy"
  | "hazardous";

export interface AQICategory {
  key: AQICategoryKey;
  label: string;
  description: string;
  color: string;
  min: number;
  max: number;
}
