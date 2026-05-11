/** Web src/index.css + App.css + Derslerim.css ile hizalı (açık tema) */
export const colors = {
  bg: "#f8fafc",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  primary: "#667eea",
  primaryDark: "#764ba2",
  primarySoft: "#e9ecff",
  border: "#e5e7eb",
  success: "#22c55e",
  danger: "#ef4444",
  dark: "#374151",
  surface: "#f9fafb",
  surfaceStrong: "#eef2ff",
  accentBlue: "#3b82f6",
  accentCyan: "#06b6d4",
  logout: "#ff4d4d",
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};

/** AI Kocu — web ana mor-mavi paletle uyumlu */
export const aiCoach = {
  primary: "#667eea",
  primaryDark: "#5b4fcf",
  primarySoft: "#e9ecff",
  primarySoftStrong: "#dce3ff",
  pageBg: "#f8fafc",
  cardBg: "#ffffff",
  cardMuted: "#f9fafb",
  savedCardBg: "#f1f5f9",
  text: "#111827",
  textBody: "#334155",
  muted: "#6b7280",
  border: "#e5e7eb",
  borderSubtle: "#f1f5f9",
  heroSolid: "#5b4fcf",
  heroBorder: "#4c3d9e",
  heroShadow: "#667eea",
  heroTextMuted: "rgba(255,255,255,0.88)",
  heroPillBg: "rgba(255,255,255,0.15)",
  heroPillBorder: "rgba(255,255,255,0.28)",
  bubbleUser: "#667eea",
  bubbleAsstBg: "#f9fafb",
  bubbleAsstBorder: "#e5e7eb",
  chipBg: "#e9ecff",
  chipBorder: "#c7d2fe",
  chipText: "#312e81",
  rowBg: "#f9fafb",
  riskBg: "#fff4e6",
  riskText: "#9a3412",
  danger: "#dc2626",
  ghostBg: "#ffffff",
  ghostBorder: "#667eea",
  ghostText: "#5b4fcf",
  quickChipBg: "#e9ecff",
  quickChipBorder: "#e5e7eb",
};

/** Gece modu — ekran ve ui bileşenleri */
export function getAppColors(dark) {
  if (!dark) return colors;
  return {
    bg: "#0f172a",
    card: "#1e293b",
    text: "#f1f5f9",
    muted: "#94a3b8",
    primary: "#818cf8",
    primaryDark: "#6366f1",
    primarySoft: "rgba(129, 140, 248, 0.22)",
    border: "#334155",
    success: "#34d399",
    danger: "#f87171",
    dark: "#cbd5e1",
    surface: "#111827",
    surfaceStrong: "#1e293b",
    accentBlue: "#60a5fa",
    accentCyan: "#22d3ee",
    logout: "#f87171",
  };
}

export function getAiCoachTheme(dark) {
  if (!dark) return aiCoach;
  return {
    ...aiCoach,
    primary: "#818cf8",
    primaryDark: "#6366f1",
    primarySoft: "rgba(129, 140, 248, 0.2)",
    primarySoftStrong: "rgba(99, 102, 241, 0.35)",
    pageBg: "#0f172a",
    cardBg: "#1e293b",
    cardMuted: "#111827",
    savedCardBg: "#0f172a",
    text: "#f1f5f9",
    textBody: "#cbd5e1",
    muted: "#94a3b8",
    border: "#334155",
    borderSubtle: "#1e293b",
    bubbleAsstBg: "#111827",
    bubbleAsstBorder: "#334155",
    chipBg: "rgba(99, 102, 241, 0.25)",
    chipBorder: "#475569",
    chipText: "#e0e7ff",
    rowBg: "#111827",
    riskBg: "#422006",
    riskText: "#fdba74",
    ghostBg: "#1e293b",
    ghostBorder: "#818cf8",
    ghostText: "#c7d2fe",
    quickChipBg: "#1e293b",
    quickChipBorder: "#334155",
  };
}
