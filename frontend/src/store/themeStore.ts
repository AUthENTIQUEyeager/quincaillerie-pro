import { create } from "zustand";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("qp-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem("qp-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    set({ theme: next });
  },
  setTheme: (t) => {
    localStorage.setItem("qp-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
    set({ theme: t });
  },
}));
