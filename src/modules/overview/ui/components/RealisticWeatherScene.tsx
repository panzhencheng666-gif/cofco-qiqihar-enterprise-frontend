import type { CSSProperties } from "react";

import type { WeatherObservation } from "../../domain/operationalSituation";
import { publicAssetUrl } from "../../../../shared/assets/publicAssetUrl";
import { liveWeatherKind } from "./liveWeatherPresentation";

export function RealisticWeatherScene({
  areaName,
  weather,
}: {
  areaName: string;
  weather: WeatherObservation;
}) {
  const kind = liveWeatherKind(weather).toLowerCase();
  const style = {
    "--weather-wind": `${weather.windDirectionDegrees ?? 0}deg`,
    backgroundImage: `linear-gradient(180deg, rgba(4, 16, 20, 0.08), rgba(4, 12, 11, 0.42)), url("${publicAssetUrl("overview/command-terrain-v2.webp")}")`,
  } as CSSProperties;

  return (
    <figure
      aria-label={`${areaName}实时天气动态场景`}
      className={`realistic-weather-scene is-${kind}`}
      role="img"
      style={style}
    >
      <div className="realistic-weather-scene__atmosphere" aria-hidden="true">
        <i className="realistic-weather-scene__sun" />
        <i className="realistic-weather-scene__cloud is-back" />
        <i className="realistic-weather-scene__cloud is-front" />
        <span className="realistic-weather-scene__precipitation">
          {Array.from({ length: 18 }, (_, index) => (
            <i key={index} style={{ "--drop": index } as CSSProperties} />
          ))}
        </span>
        <i className="realistic-weather-scene__lightning" />
      </div>
      <figcaption>
        <span>{areaName}</span>
        <strong>
          {weather.meanTemperatureC === null
            ? "—"
            : `${weather.meanTemperatureC.toLocaleString("zh-CN")}℃`}
        </strong>
      </figcaption>
    </figure>
  );
}
