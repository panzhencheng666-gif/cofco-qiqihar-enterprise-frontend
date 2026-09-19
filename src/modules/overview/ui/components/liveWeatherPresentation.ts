import type { WeatherObservation } from "../../domain/operationalSituation";

export type LiveWeatherKind = "CLEAR" | "CLOUD" | "RAIN" | "SNOW" | "STORM";

export function liveWeatherKind(weather: WeatherObservation): LiveWeatherKind {
  const code = weather.weatherCode;
  if (code !== undefined && code !== null) {
    if (code >= 95) return "STORM";
    if (code >= 71 && code <= 86) return "SNOW";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "RAIN";
    if (code >= 1 && code <= 3) return "CLOUD";
  }
  if (weather.risk.includes("暴雨") || weather.risk.includes("雷")) return "STORM";
  if (weather.risk.includes("降雨") || weather.risk.includes("降水")) return "RAIN";
  if ((weather.meanTemperatureC ?? 1) <= 0 && (weather.precipitationMm ?? 0) > 0)
    return "SNOW";
  if ((weather.precipitationMm ?? 0) > 0) return "RAIN";
  if ((weather.cloudCoverPercent ?? 0) >= 55) return "CLOUD";
  return "CLEAR";
}

export function liveWeatherHeadline(areaName: string, weather: WeatherObservation) {
  const kind = liveWeatherKind(weather);
  if (kind === "STORM") return `${areaName}强对流天气风险提示`;
  if (kind === "SNOW") return `${areaName}降雪与低温影响提示`;
  if (kind === "RAIN") return `${areaName}降雨影响提示`;
  if (kind === "CLOUD") return `${areaName}云量与作业条件观测`;
  return `${areaName}实时天气态势`;
}

export function liveWeatherEvidence(weather: WeatherObservation) {
  const kind = liveWeatherKind(weather);
  if (kind === "STORM") return "强对流信号 → 降水与大风 → 田间作业风险";
  if (kind === "SNOW") return "降雪低温 → 地表冻结 → 运输与存储风险";
  if (kind === "RAIN") return "实时降雨 → 土壤墒情变化 → 田间作业风险";
  if (kind === "CLOUD") return "云量变化 → 光照条件变化 → 作业窗口评估";
  return "实时气温与墒情 → 作业条件评估";
}
