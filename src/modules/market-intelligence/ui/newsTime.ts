const beijingDay = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Shanghai",
});
const beijingTime = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

export function beijingCalendarDay(instant: Date): string {
  return beijingDay.format(instant).replaceAll("/", "-");
}

export function beijingInstantLabel(instant: string): string {
  return `${beijingTime.format(new Date(instant))} 北京时间`;
}

export function newsPublicationLabel(item: {
  publishedAt: string;
  publishedOn: string;
  publicationPrecision: "date" | "instant";
}): string {
  if (item.publicationPrecision === "date")
    return `${item.publishedOn} · 来源仅提供日期`;
  return beijingInstantLabel(item.publishedAt);
}

export function isNewsPublishedToday(
  publishedOn: string,
  now: Date = new Date(),
): boolean {
  return publishedOn === beijingCalendarDay(now);
}
