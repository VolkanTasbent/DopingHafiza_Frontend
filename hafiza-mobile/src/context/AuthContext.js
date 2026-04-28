import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { clearToken, getToken, setToken } from "../services/storage";
import { getMe, login as loginRequest, register as registerRequest } from "../services/auth";

const AuthContext = createContext(null);

/** Fiziksel cihazda backend yok / ag kopuk ise sonsuz splash yerine giris ekranina dus. */
const BOOTSTRAP_MS = 12000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("bootstrap_timeout")), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/** Expo Web + emülatör / iOS simülatör: giris ekrani yok; token yoksa misafir ile ana ekran. */
const DEV_GUEST_USER = {
  id: null,
  email: "dev@guest.local",
  ad: "Dev",
  soyad: "Oturumu",
  role: "USER",
};

function skipLoginScreen() {
  if (Platform.OS === "web") return true;
  return Device.isDevice === false;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (skipLoginScreen()) {
        try {
          const token = await getToken();
          if (token) {
            try {
              const me = await withTimeout(getMe(), BOOTSTRAP_MS);
              setUser(me);
            } catch {
              await clearToken();
              setUser(DEV_GUEST_USER);
            }
          } else {
            setUser(DEV_GUEST_USER);
          }
        } catch {
          setUser(DEV_GUEST_USER);
        } finally {
          setTokenChecked(true);
        }
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          setUser(null);
          return;
        }
        const me = await withTimeout(getMe(), BOOTSTRAP_MS);
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
        setUser(skipLoginScreen() ? DEV_GUEST_USER : null);
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
