import { z } from "zod";

export type OfficialPlaybackSelection = ({ id: string } | { mediaUrl: string }) & {
  name: string;
};

export function isFaoProgrammePage(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === "https://www.fao.org" &&
      !url.username &&
      !url.password &&
      (url.pathname.startsWith(
        "/markets-and-trade/news-and-events/multimedia/video-detail/",
      ) ||
        url.pathname.startsWith("/webcast/detail/"))
    );
  } catch {
    return false;
  }
}

const playbackSchema = z.union([
  z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }),
  z.object({
    mediaUrl: z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.origin === "https://vod.fao.org" &&
        !url.username &&
        !url.password &&
        url.pathname.startsWith("/video/") &&
        url.pathname.endsWith(".mp4")
      );
    }),
  }),
]);

export async function loadOfficialPlayback(url: string, signal: AbortSignal) {
  const response = await fetch(
    `/api/v1/market-intelligence/news/videos/playback?url=${encodeURIComponent(url)}`,
    {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return z.object({ data: playbackSchema }).parse(await response.json()).data;
}
