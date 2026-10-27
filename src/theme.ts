import { useSyncExternalStore } from "react";
export type Theme = "light" | "dark" | "pink";
export function readTheme(): Theme {
  try {
    const v = localStorage.getItem("moneyspace-theme");
    return v === "dark" || v === "pink" ? v : "light";
  } catch {
    return "light";
  }
}
let state = { theme: readTheme(), error: "" };
const listeners = new Set<() => void>();
function apply() {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = state.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        state.theme === "dark"
          ? "#062e37"
          : state.theme === "pink"
            ? "#fff5f8"
            : "#f3f7f5",
      );
    document.documentElement.style.colorScheme =
      state.theme === "dark" ? "dark" : "light";
  }
}
apply();
export function setTheme(theme: Theme) {
  let error = "";
  try {
    localStorage.setItem("moneyspace-theme", theme);
  } catch {
    error = "เปลี่ยนธีมชั่วคราวแล้ว แต่บันทึกบนเครื่องนี้ไม่ได้";
  }
  state = { theme, error };
  apply();
  listeners.forEach((fn) => fn());
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === "moneyspace-theme" || e.key === null) {
      state = { theme: readTheme(), error: "" };
      apply();
      listeners.forEach((fn) => fn());
    }
  });
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function useTheme() {
  const value = useSyncExternalStore(subscribe, () => state);
  return {
    ...value,
    light: value.theme !== "dark",
    setTheme,
    toggle: () => setTheme(value.theme === "dark" ? "light" : "dark"),
  };
}
