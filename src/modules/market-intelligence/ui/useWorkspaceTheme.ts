import { useState } from "react";

export type WorkspaceTheme = "dark" | "light";
const storageKey = "mi-analysis-theme-v1";

export function useWorkspaceTheme() {
  const [theme, setTheme] = useState<WorkspaceTheme>(() => {
    try {
      return localStorage.getItem(storageKey) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  function selectTheme(next: WorkspaceTheme) {
    setTheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Keep local UI usable. */
    }
  }
  return { theme, selectTheme };
}
