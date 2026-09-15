import { useCallback, useEffect, useRef } from "react";
import { RELIEF_DOUBLE_CLICK_LAYOUT_DELAY_MS } from "./useReliefLabelPriority";

/** Keep the first click from triggering heavy layout work before the second arrives. */
export function useDeferredMapSelection() {
  const timer = useRef<number | undefined>(undefined);
  const cancel = useCallback(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  const schedule = useCallback((select: () => void) => {
    cancel();
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      select();
    }, RELIEF_DOUBLE_CLICK_LAYOUT_DELAY_MS);
  }, [cancel]);
  useEffect(() => cancel, [cancel]);
  return { schedule, cancel };
}
