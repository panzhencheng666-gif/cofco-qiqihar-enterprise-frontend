import { useEffect, useRef, type ReactNode } from "react";

/** Keeps evidence readable without losing the table's position or keyboard focus. */
export function RegionalReadingDialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    sheet.current?.focus();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <aside
      ref={sheet}
      className="overview-data-mode__detail-sheet regional-reading-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (event.key !== "Tab") return;
        const items = Array.from(
          sheet.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input, select, [tabindex="0"]',
          ) ?? [],
        );
        const first = items[0],
          last = items[items.length - 1];
        if (!first || !last) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === sheet.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === sheet.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      {children}
    </aside>
  );
}
