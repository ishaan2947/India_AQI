/**
 * Thin axios wrapper exposing one function per backend endpoint.
 *
 * Why a wrapper rather than calling axios from components? Two reasons:
 *   1. Components stay decoupled from the HTTP layer (mock in tests).
 *   2. Response typing happens in one place — components consume `Promise<X>`
 *      and never have to think about `AxiosResponse<X>`.
 */

import axios from "axios";
import type {
  AllPredictionsResponse,
  AQIReading,
  CityWithLatest,
  PredictionResponse,
  StatsResponse,
} from "../types";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const http = axios.create({
  baseURL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.response.use(
  (r) => r,
  (error) => {
    // Surface a friendlier error message; let the caller decide how to render.
    const message =
      error?.response?.data?.detail ?? error?.message ?? "Network error";
    return Promise.reject(new Error(message));
  },
);

export async function fetchCities(): Promise<CityWithLatest[]> {
  const res = await http.get<CityWithLatest[]>("/cities");
  return res.data;
}

export async function fetchCity(cityId: number): Promise<CityWithLatest> {
  const res = await http.get<CityWithLatest>(`/cities/${cityId}`);
  return res.data;
}

export async function fetchCurrentAQI(): Promise<CityWithLatest[]> {
  const res = await http.get<CityWithLatest[]>("/aqi/current");
  return res.data;
}

export async function fetchCityHistory(
  cityId: number,
  hours = 24,
): Promise<AQIReading[]> {
  const res = await http.get<AQIReading[]>(`/aqi/${cityId}/history`, {
    params: { hours },
  });
  return res.data;
}

export async function fetchCityLatest(cityId: number): Promise<AQIReading> {
  const res = await http.get<AQIReading>(`/aqi/${cityId}/latest`);
  return res.data;
}

export async function fetchPrediction(
  cityId: number,
): Promise<PredictionResponse> {
  const res = await http.get<PredictionResponse>(`/predictions/${cityId}`);
  return res.data;
}

export async function fetchAllPredictions(): Promise<AllPredictionsResponse> {
  const res = await http.get<AllPredictionsResponse>("/predictions/all");
  return res.data;
}

export async function fetchWorst(): Promise<StatsResponse> {
  const res = await http.get<StatsResponse>("/stats/worst");
  return res.data;
}

export async function fetchBest(): Promise<StatsResponse> {
  const res = await http.get<StatsResponse>("/stats/best");
  return res.data;
}

export async function triggerRefresh(): Promise<{
  stored_readings: number;
  message: string;
}> {
  const res = await http.post("/admin/refresh");
  return res.data;
}
