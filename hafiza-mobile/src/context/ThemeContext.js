import { createContext, useContext, useMemo } from "react";
import { getAiCoachTheme, getAppColors } from "../theme";
import { useUiPrefs } from "./UiPrefsContext";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { darkMode, toggleDarkMode } = useUiPrefs();
  const colors = useMemo(() => getAppColors(darkMode), [darkMode]);
  const aiCoach = useMemo(() => getAiCoachTheme(darkMode), [darkMode]);
  const value = useMemo(
    () => ({ colors, aiCoach, darkMode, toggleDarkMode }),
    [colors, aiCoach, darkMode, toggleDarkMode]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider (inside UiPrefsProvider).");
  }
  return ctx;
}
