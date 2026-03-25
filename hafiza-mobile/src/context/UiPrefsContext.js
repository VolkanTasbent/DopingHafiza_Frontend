import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getJSON, setJSON } from "../services/storage";
import { fetchProfile, updateProfile } from "../services/quiz";
import { useAuth } from "./AuthContext";

const UiPrefsContext = createContext(null);

export function UiPrefsProvider({ children }) {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  const storageKey = useMemo(() => `ui_prefs_${user?.id || "anon"}`, [user?.id]);

  useEffect(() => {
    (async () => {
      const local = await getJSON(storageKey, null);
      if (typeof local?.darkMode === "boolean") {
        setDarkMode(local.darkMode);
      }
      if (!user?.id) return;
      try {
        const me = await fetchProfile();
        if (typeof me?.darkMode === "boolean") {
          setDarkMode(me.darkMode);
          await setJSON(storageKey, { darkMode: me.darkMode });
        }
      } catch {
        // ignore backend preference read errors
      }
    })();
  }, [storageKey, user?.id]);

  const toggleDarkMode = useCallback(async () => {
    const next = !darkMode;
    setDarkMode(next);
    await setJSON(storageKey, { darkMode: next });
    if (!user?.id) return;
    try {
      const current = await fetchProfile();
      await updateProfile({ ...(current || {}), darkMode: next });
    } catch {
      // keep local preference even if backend update fails
    }
  }, [darkMode, storageKey, user?.id]);

  const value = useMemo(() => ({ darkMode, toggleDarkMode }), [darkMode, toggleDarkMode]);
  return <UiPrefsContext.Provider value={value}>{children}</UiPrefsContext.Provider>;
}

export function useUiPrefs() {
  const ctx = useContext(UiPrefsContext);
  if (!ctx) throw new Error("useUiPrefs must be used inside UiPrefsProvider");
  return ctx;
}
