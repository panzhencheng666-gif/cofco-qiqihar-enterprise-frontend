import { useEffect, useMemo, useState } from "react";

import type { WeatherObservation } from "../../domain/operationalSituation";
import {
  latestRadarFrame,
  liveRadarImageUrl,
  liveSatelliteExportUrl,
  type LiveRadarFrame,
  type RadarMapsResponse,
} from "./liveWeatherImagery";
import { liveWeatherKind } from "./liveWeatherPresentation";

const RAINVIEWER_MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";

type RadarState =
  | { status: "LOADING" }
  | { status: "READY"; frame: LiveRadarFrame }
  | { status: "UNAVAILABLE" };

function radarObservedAt(frame: LiveRadarFrame) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(frame.observedAt * 1_000));
}

export function RealisticWeatherScene({
  areaName,
  weather,
}: {
  areaName: string;
  weather: WeatherObservation;
}) {
  const kind = liveWeatherKind(weather).toLowerCase();
  const [radarState, setRadarState] = useState<RadarState>({
    status: "LOADING",
  });
  const satelliteUrl = useMemo(
    () => liveSatelliteExportUrl(weather.longitude, weather.latitude),
    [weather.latitude, weather.longitude],
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetch(RAINVIEWER_MAPS_URL, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`RainViewer ${response.status}`);
        return response.json() as Promise<RadarMapsResponse>;
      })
      .then((response) => {
        const frame = latestRadarFrame(response);
        setRadarState(frame ? { status: "READY", frame } : { status: "UNAVAILABLE" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRadarState({ status: "UNAVAILABLE" });
      });

    return () => controller.abort();
  }, []);

  return (
    <figure
      aria-label={`${areaName}实时天气动态场景`}
      className={`realistic-weather-scene is-${kind}`}
      role="img"
    >
      <img
        alt=""
        aria-hidden="true"
        className="realistic-weather-scene__satellite"
        src={satelliteUrl}
      />
      {radarState.status === "READY" ? (
        <img
          alt=""
          aria-hidden="true"
          className="realistic-weather-scene__radar"
          src={liveRadarImageUrl(radarState.frame, weather.longitude, weather.latitude)}
        />
      ) : null}
      <span className="realistic-weather-scene__live-status">
        {radarState.status === "LOADING" ? "实时雷达同步中" : null}
        {radarState.status === "READY"
          ? `雷达观测 ${radarObservedAt(radarState.frame)}`
          : null}
        {radarState.status === "UNAVAILABLE" ? "实时雷达不可用" : null}
      </span>
      <span className="realistic-weather-scene__source">
        卫星影像 Esri · 降水雷达 RainViewer
      </span>
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
