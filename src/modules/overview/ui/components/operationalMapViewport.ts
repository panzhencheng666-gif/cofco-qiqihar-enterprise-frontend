export interface OperationalMapPadding {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export function calculateOperationalMapPadding(
  container: HTMLElement,
  minimumTop = 160,
): OperationalMapPadding {
  const fallback: OperationalMapPadding = {
    bottom: 54,
    left: 54,
    right: 54,
    top: minimumTop,
  };
  const commandCenter = container.closest(".overview-command-center");
  if (!commandCenter || container.clientWidth <= 0 || container.clientHeight <= 0) {
    return fallback;
  }
  const containerRect = container.getBoundingClientRect();
  const scaleX = containerRect.width / container.clientWidth || 1;
  const scaleY = containerRect.height / container.clientHeight || 1;
  const panel = commandCenter.querySelector<HTMLElement>(".overview-data-mode");
  const tools = commandCenter.querySelector<HTMLElement>(".overview-command-tools");
  const panelRect = panel?.getBoundingClientRect();
  const toolsRect = tools?.getBoundingClientRect();
  const panelOverlap = panelRect
    ? Math.max(0, (containerRect.right - panelRect.left) / scaleX)
    : 0;
  const toolsBottom = toolsRect
    ? Math.max(0, (toolsRect.bottom - containerRect.top) / scaleY + 16)
    : 0;
  return {
    bottom: 54,
    left: 54,
    right: Math.max(54, Math.ceil(panelOverlap + (panelOverlap > 0 ? 22 : 0))),
    top: Math.max(minimumTop, Math.ceil(toolsBottom)),
  };
}
