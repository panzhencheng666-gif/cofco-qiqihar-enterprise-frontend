// Recognises player IDs, not playback permission or current live status.
export function videoIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else if (url.pathname.startsWith("/live/"))
        id = url.pathname.split("/")[2] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
