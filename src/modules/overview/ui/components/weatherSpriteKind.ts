import type { WeatherObservation } from "../../domain/operationalSituation";
import { liveWeatherKind, type LiveWeatherKind } from "./liveWeatherPresentation";
export type WeatherSpriteKind = LiveWeatherKind | "CLEAR_NIGHT" | "UNKNOWN";

export function weatherSpriteKind(weather: WeatherObservation): WeatherSpriteKind {
  if (
    weather.weatherCode == null &&
    weather.cloudCoverPercent == null &&
    !(weather.precipitationMm && weather.precipitationMm > 0)
  )
    return "UNKNOWN";
  const kind = liveWeatherKind(weather);
  if (kind !== "CLEAR") return kind;
  const date = new Date(weather.observedAt);
  if (!Number.isFinite(date.getTime())) return "UNKNOWN";
  // Approximate solar elevation determines the illustration's day/night variant.
  // It is not an astronomical sunrise service or a weather observation.
  const radians = Math.PI / 180;
  const day = (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000;
  const declination = 23.44 * radians * Math.sin((2 * Math.PI * (day - 81)) / 365.2422);
  const solarHour =
    date.getUTCHours() + date.getUTCMinutes() / 60 + weather.longitude / 15;
  const hourAngle = (solarHour - 12) * 15 * radians;
  const latitude = weather.latitude * radians;
  const altitude =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  return altitude > 0 ? "CLEAR" : "CLEAR_NIGHT";
}
