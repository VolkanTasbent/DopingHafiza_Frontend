import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearToken, getToken, setToken } from "../services/storage";
import { getMe, login as loginRequest, register as registerRequest } from "../services/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const me = await getMe();
        setUser(me);
      } catch {
        await clearToken();
        setUser(null);
      } finally {
        setTokenChecked(true);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      tokenChecked,
      isAuthenticated: !!user,
      async login(email, password) {
        setLoading(true);
        try {
          const data = await loginRequest(email, password);
          if (!data?.token || !data?.user) {
            throw new Error("Giris basarili ancak token veya user donmedi.");
          }
          await setToken(data.token);
          setUser(data.user);
        } finally {
          setLoading(false);
        }
      },
      async register(payload) {
        setLoading(true);
        try {
          await registerRequest(payload);
        } finally {
          setLoading(false);
        }
      },
      async logout() {
        await clearToken();
        setUser(null);
      },
    }),
    [user, loading, tokenChecked]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
