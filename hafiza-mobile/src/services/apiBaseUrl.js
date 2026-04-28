import Constants from "expo-constants";
import * as Device from "expo-device";
import { NativeModules, Platform } from "react-native";

/**
 * Web (Vite) ile ayni varsayilan: src/services/api.js -> localhost:8085
 * Farkli port icin: EXPO_PUBLIC_API_PORT=8080
 */
const API_PORT = String(process.env.EXPO_PUBLIC_API_PORT || "8085").replace(/^:/, "");

function stripTrailingSlash(url) {
  return String(url || "").trim().replace(/\/$/, "");
}

function isPrivateLanIPv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const o = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (o.some((n) => n > 255 || Number.isNaN(n))) return false;
  const [a, b] = o;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isLoopbackHost(host) {
  if (!host || typeof host !== "string") return true;
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost");
}

function looksLikeTunnelOrCloudHost(host) {
  if (!host || typeof host !== "string") return true;
  const h = host.toLowerCase();
  return h.includes("expo.dev") || h.endsWith(".exp.direct");
}

function hostFromHostUri(value) {
  if (!value || typeof value !== "string") return null;
  const withScheme = value.includes("://") ? value : `http://${value}`;
  try {
    const u = new URL(withScheme);
    return u.hostname || null;
  } catch {
    const m = /^([^/:]+)(?::\d+)?$/.exec(value.trim());
    return m ? m[1] : null;
  }
}

function packagerHostFromScript() {
  const url = NativeModules?.SourceCode?.scriptURL;
  if (!url || typeof url !== "string") return null;
  const m = url.match(/\/\/([^/:?]+)(?::\d+)?/);
  return m ? m[1] : null;
}

/** Expo CLI gelistirmede hostUri / klasik manifest debuggerHost (SourceCode bos ise). */
function packagerHostFromExpoConstants() {
  try {
    const ec = Constants.expoConfig;
    const fromEc = ec && hostFromHostUri(ec.hostUri);
    if (fromEc) return fromEc;

    const pf = Constants.platform;
    const fromPf = pf && hostFromHostUri(pf.hostUri);
    if (fromPf) return fromPf;

    const legacy = Constants.__unsafeNoWarnManifest || Constants.manifest;
    if (legacy && typeof legacy === "object" && legacy.debuggerHost) {
      const h = String(legacy.debuggerHost).split(":")[0];
      return h || null;
    }
  } catch {
    /* expo-constants yoksa veya manifest beklenmedik */
  }
  return null;
}

/** exp://192.168.x.x:8081 gibi — fiziksel cihazda scriptURL bazen localhost kalir. */
function packagerHostFromExpoDeepLink() {
  try {
    const candidates = [Constants.linkingUri, Constants.experienceUrl];
    for (const raw of candidates) {
      if (!raw || typeof raw !== "string") continue;
      let s = raw.split("?")[0].trim();
      if (s.startsWith("exp://")) s = `http://${s.slice(6)}`;
      else if (s.startsWith("exps://")) s = `https://${s.slice(7)}`;
      else if (!s.includes("://")) s = `http://${s}`;
      const host = hostFromHostUri(s);
      if (host && isPrivateLanIPv4(host)) return host;
    }
  } catch {
    /* */
  }
  return null;
}

/** Fiziksel cihazda loopback Metro adresini API icin kullanma; once LAN IP / .local host bul. */
function pickPackagerHost() {
  const script = packagerHostFromScript();
  const expo = packagerHostFromExpoConstants();
  const deep = packagerHostFromExpoDeepLink();
  const ordered = [expo, deep, script];

  if (Device.isDevice) {
    for (const h of ordered) {
      if (h && isPrivateLanIPv4(h)) return h;
    }
    for (const h of ordered) {
      if (h && !isLoopbackHost(h) && !looksLikeTunnelOrCloudHost(h)) return h;
    }
    return null;
  }

  return script || expo || deep || null;
}

/** Yalniz Android emülatör: localhost makineyi gösterir (10.0.2.2). Fiziksel telefonda dokunma. */
function rewriteAndroidEmulatorLocalhost(url) {
  if (Platform.OS !== "android" || !url || Device.isDevice) return url;
  if (/^https?:\/\/localhost\b/i.test(url)) {
    return url.replace(/^http:\/\/localhost/i, "http://10.0.2.2").replace(/^https:\/\/localhost/i, "https://10.0.2.2");
  }
  if (/^https?:\/\/127\.0\.0\.1\b/i.test(url)) {
    return url.replace(/^http:\/\/127\.0\.0\.1/i, "http://10.0.2.2").replace(/^https:\/\/127\.0\.0\.1/i, "https://10.0.2.2");
  }
  return url;
}

function urlHostIsLoopback(url) {
  try {
    const u = new URL(url.includes("://") ? url : `http://${url}`);
    return isLoopbackHost(u.hostname);
  } catch {
    return false;
  }
}

/** .env localhost fiziksel cihazda telefonu isaret eder; Metro LAN host + env’deki port. */
function swapLoopbackHostForDeviceLan(url) {
  try {
    const u = new URL(url.includes("://") ? url : `http://${url}`);
    if (!isLoopbackHost(u.hostname)) return null;
    const port = u.port || API_PORT;
    const lan = pickPackagerHost();
    if (!lan || isLoopbackHost(lan)) return null;
    const base = `${u.protocol}//${lan}:${port}`;
    const tail = `${u.pathname || ""}${u.search || ""}`;
    return stripTrailingSlash(base + (tail === "/" ? "" : tail));
  } catch {
    return null;
  }
}

/**
 * Backend tabani: EXPO_PUBLIC_API_URL -> app.json extra.apiBaseUrl -> Metro host + port.
 * Varsayilan port web (Vite) ile ayni: 8085. Android emülatör: 10.0.2.2.
 */
export function getApiBaseUrl() {
  const env = stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL);
  if (env) {
    const resolved = rewriteAndroidEmulatorLocalhost(env);
    if (Device.isDevice && urlHostIsLoopback(resolved)) {
      const swapped = swapLoopbackHostForDeviceLan(resolved);
      if (swapped) return swapped;
      /* localhost .env fiziksel cihazda gecersiz; asagida Metro’dan türet */
    } else {
      return resolved;
    }
  }

  const extraRaw = Constants.expoConfig?.extra?.apiBaseUrl;
  const extraUrl = typeof extraRaw === "string" ? stripTrailingSlash(extraRaw) : "";
  if (extraUrl) {
    const resolved = rewriteAndroidEmulatorLocalhost(extraUrl);
    if (Device.isDevice && urlHostIsLoopback(resolved)) {
      const swapped = swapLoopbackHostForDeviceLan(resolved);
      if (swapped) return swapped;
    } else {
      return resolved;
    }
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:${API_PORT}`;
  }

  const host = pickPackagerHost();

  if (host && isPrivateLanIPv4(host)) {
    return `http://${host}:${API_PORT}`;
  }

  if (Platform.OS === "android" && !Device.isDevice) {
    if (!host || isLoopbackHost(host) || host === "10.0.2.2") {
      return `http://10.0.2.2:${API_PORT}`;
    }
  }

  if (!Device.isDevice && (!host || isLoopbackHost(host))) {
    return `http://localhost:${API_PORT}`;
  }

  if (host && !isLoopbackHost(host)) {
    return `http://${host}:${API_PORT}`;
  }

  if (Device.isDevice) {
    const scriptHost = packagerHostFromScript();
    if (scriptHost && isLoopbackHost(scriptHost)) {
      if (__DEV__) {
        console.warn(
          `[getApiBaseUrl] Fiziksel cihazda yalnizca loopback Metro (${scriptHost}); API icin USB ise adb reverse tcp:${API_PORT} tcp:${API_PORT} deneyin.`
        );
      }
      return `http://localhost:${API_PORT}`;
    }
  }

  if (__DEV__) {
    console.warn(
      "[getApiBaseUrl] Backend adresi cözülemedi; .env: EXPO_PUBLIC_API_URL=http://<Mac_LAN_IP>:" +
        API_PORT +
        " veya app.json extra.apiBaseUrl"
    );
  }

  return `http://localhost:${API_PORT}`;
}
