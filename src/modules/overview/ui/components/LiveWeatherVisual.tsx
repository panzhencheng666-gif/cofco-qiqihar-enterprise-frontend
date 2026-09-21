import type { WeatherObservation } from "../../domain/operationalSituation";
import type { CSSProperties } from "react";
import { liveWeatherKind } from "./liveWeatherPresentation";

export function LiveWeatherVisual({
  compact = false,
  weather,
}: {
  compact?: boolean;
  weather: WeatherObservation;
}) {
  const kind = liveWeatherKind(weather).toLowerCase();
  return (
    <div
      aria-label={`动态天气：${weather.regionName}`}
      className={`live-weather-visual is-${kind}${compact ? " is-compact" : ""}`}
      role="img"
    >
      <i className="live-weather-visual__radar" />
      <i className="live-weather-visual__cloud" />
      <i className="live-weather-visual__bolt" />
      <span className="live-weather-visual__precipitation" aria-hidden="true">
        {Array.from({ length: compact ? 4 : 10 }, (_, index) => (
          <i key={index} style={{ "--drop": index } as CSSProperties} />
        ))}
      </span>
      <b>{weather.meanTemperatureC === null ? "—" : `${weather.meanTemperatureC}℃`}</b>
    </div>
  );
}
