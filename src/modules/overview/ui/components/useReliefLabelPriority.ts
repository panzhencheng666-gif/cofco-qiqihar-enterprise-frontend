import { useEffect, useState } from "react";

export const RELIEF_DOUBLE_CLICK_LAYOUT_DELAY_MS = 220;

/** Preserve the first-click target while details respond immediately. */
export function useReliefLabelPriority(selectedCode: string) {
  const [priorityCode, setPriorityCode] = useState(selectedCode);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPriorityCode(selectedCode);
    }, RELIEF_DOUBLE_CLICK_LAYOUT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [selectedCode]);
  return priorityCode;
}
