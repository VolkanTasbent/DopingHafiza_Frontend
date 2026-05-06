import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchDersler, fetchRaporlar } from "../services/quiz";
import { useAuth } from "../context/AuthContext";
import { PrimaryButton, ProgressBar, SecondaryButton, SectionTitle } from "../components/ui";
import { colors } from "../theme";
import { getRecentActivities } from "../services/activity";
import { useUiPrefs } from "../context/UiPrefsContext";

/** Mobil: web menüsüyle aynı hedefler; Derslerim = der listesine kaydır */
const SHORTCUTS_BASE = [
  { id: "dersler", label: "Derslerim", emoji: "📘", nav: "scrollDersler" },
  { id: "coz", label: "Soru Çöz", emoji: "📝", nav: "quiz" },
  { id: "deneme", label: "Deneme", emoji: "📊", nav: "DenemeTab" },
  { id: "rapor", label: "Raporlar", emoji: "📈", nav: "ReportsTab" },
  { id: "grafik", label: "Grafikler", emoji: "📉", nav: "Insights" },
  { id: "gorev", label: "Görevler", emoji: "🎯", nav: "Tasks" },
  { id: "rozet", label: "Rozetler", emoji: "🏅", nav: "Badges" },
  { id: "takvim", label: "Takvim", emoji: "📅", nav: "Calendar" },
  { id: "calisma", label: "Çalışma prog.", emoji: "📋", nav: "CalismaProgrami" },
  { id: "ai", label: "AI Kocum", emoji: "🤖", nav: "AiCoach" },
  { id: "pomodoro", label: "Pomodoro", emoji: "🍅", nav: "FocusTimer" },
  { id: "flash", label: "Flash Card", emoji: "🎴", nav: "flash" },
];

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useUiPrefs();
  const scrollRef = useRef(null);
  const dersListOffsetY = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dersler, setDersler] = useState([]);
  const [raporlar, setRaporlar] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  const palette = useMemo(
    () =>
      darkMode
        ? {
            bg: "#0f172a",
            card: "#1e293b",
            text: "#e2e8f0",
            muted: "#94a3b8",
            border: "rgba(255,255,255,0.12)",
            dashHeadBorder: "rgba(255,255,255,0.1)",
            inputBg: "#0f172a",
            topbarBg: "#1e293b",
            searchBorder: "rgba(255,255,255,0.14)",
            footerBg: "#0f172a",
            heroBg: "#312e81",
            chipBg: "rgba(102, 126, 234, 0.22)",
            chipBorder: "rgba(255,255,255,0.18)",
          }
        : {
            bg: "#f8fafc",
            card: "#ffffff",
            text: "#111827",
            muted: "#6b7280",
            border: "#e5e7eb",
            dashHeadBorder: "#f1f5f9",
            inputBg: "#fafafa",
            topbarBg: "#ffffff",
            searchBorder: "#dddddd",
            footerBg: "#f9fafb",
            heroBg: "#667eea",
            chipBg: "#eef2ff",
            chipBorder: "#c7d2fe",
          },
    [darkMode]
  );

  const shortcuts = useMemo(() => {
    const admin =
      String(user?.role || "").toUpperCase() === "ADMIN"
        ? [{ id: "admin", label: "Admin", emoji: "🛠", nav: "AdminTab" }]
        : [];
    return [...SHORTCUTS_BASE, ...admin];
  }, [user?.role]);

  async function loadData(pull = false) {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const [dersData, raporData] = await Promise.all([fetchDersler(), fetchRaporlar(100)]);
      setDersler(dersData);
      setRaporlar(raporData);
      const acts = await getRecentActivities(6);
      setRecentActivities(Array.isArray(acts) ? acts : []);
    } catch (e) {
      Alert.alert("Hata", "Dersler alınamadı.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const stats = useMemo(() => {
    const totalSolved = raporlar.reduce((a, r) => a + (r.totalCount || 0), 0);
    const correct = raporlar.reduce((a, r) => a + (r.correctCount || 0), 0);
    const success = totalSolved > 0 ? Math.round((correct / totalSolved) * 100) : 0;
    return { totalSolved, correct, success };
  }, [raporlar]);

  const weeklyStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const recent = raporlar.filter((r) => {
      if (!r?.finishedAt) return false;
      return new Date(r.finishedAt) >= weekAgo;
    });
    const total = recent.reduce((a, r) => a + Number(r.totalCount || 0), 0);
    const correct = recent.reduce((a, r) => a + Number(r.correctCount || 0), 0);
    const success = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, success };
  }, [raporlar]);

  const lastActivity = recentActivities[0] || null;

  const reportByCourse = useMemo(() => {
    const byId = {};
    const byName = {};
    raporlar.forEach((r) => {
      const id = String(r?.dersId || r?.ders?.id || r?.courseId || "").trim();
      const name = String(r?.dersAd || r?.dersAdi || r?.ders?.ad || "").toLowerCase().trim();
      const update = (obj, key) => {
        if (!key) return;
        if (!obj[key]) obj[key] = { total: 0, correct: 0, wrong: 0, count: 0, lastAt: null };
        obj[key].total += Number(r?.totalCount || 0);
        obj[key].correct += Number(r?.correctCount || 0);
        obj[key].wrong += Number(r?.wrongCount || 0);
        obj[key].count += 1;
        if (r?.finishedAt) {
          const d = new Date(r.finishedAt);
          if (!obj[key].lastAt || d > new Date(obj[key].lastAt)) obj[key].lastAt = r.finishedAt;
        }
      };
      update(byId, id);
      update(byName, name);
    });
    return { byId, byName };
  }, [raporlar]);

  function getCoursePerf(ders) {
    const idKey = String(ders?.id || "").trim();
    const nameKey = String(ders?.ad || "").toLowerCase().trim();
    const base = (idKey && reportByCourse.byId[idKey]) || (nameKey && reportByCourse.byName[nameKey]) || null;
    if (!base) return null;
    const success = base.total > 0 ? Math.round((base.correct / base.total) * 100) : 0;
    const net = Number((base.correct - base.wrong / 4).toFixed(2));
    return { ...base, success, net };
  }

  function formatShortDate(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("tr-TR");
    } catch {
      return "-";
    }
  }

  function navigateTo(action) {
    if (!action) return;
    if (action === "quiz") {
      const first = dersler[0];
      if (!first) {
        Alert.alert("Bilgi", "Soru çözmek için önce bir ders bulunmalı.");
        return;
      }
      navigation.navigate("Quiz", { ders: first });
      return;
    }
    if (action === "flash") {
      navigation.navigate("Flashcards");
      return;
    }
    if (action === "CalismaProgrami") {
      navigation.navigate("CalismaProgrami");
      return;
    }
    const mainTabsScreens = ["HomeTab", "DenemeTab", "ReportsTab", "GameTab", "ProfileTab", "AdminTab"];
    if (mainTabsScreens.includes(action)) {
      navigation.navigate("MainTabs", { screen: action });
      return;
    }
    navigation.navigate(action);
  }

  function scrollToDersList() {
    requestAnimationFrame(() => {
      const y = dersListOffsetY.current;
      if (y > 8) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      } else if (!loading && dersler.length > 0) {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    });
  }

  function handleShortcut(nav) {
    if (nav === "scrollDersler") {
      scrollToDersList();
      return;
    }
    navigateTo(nav);
  }

  function openRecentActivity(activity) {
    const meta = activity?.meta && typeof activity.meta === "object" ? activity.meta : null;
    const type = String(activity?.type || "").toLowerCase();
    const title = String(activity?.title || "").toLowerCase();
    const subtitle = String(activity?.subtitle || "").toLowerCase();
    const text = `${type} ${title} ${subtitle}`;

    if (text.includes("video") || text.includes("not")) {
      navigation.navigate("VideoLessons", {
        dersId: meta?.dersId ?? null,
        konuId: meta?.konuId ?? null,
        videoId: meta?.videoId ?? null,
        videoUrl: meta?.videoUrl ?? null,
        noteSeconds: meta?.noteSeconds ?? null,
      });
      return;
    }
    if (text.includes("deneme")) {
      navigation.navigate("MainTabs", { screen: "DenemeTab" });
      return;
    }
    if (text.includes("rapor")) {
      navigation.navigate("MainTabs", { screen: "ReportsTab" });
      return;
    }
    if (text.includes("gorev")) {
      navigation.navigate("Tasks");
      return;
    }
    if (text.includes("takvim")) {
      navigation.navigate("Calendar");
      return;
    }
    if (text.includes("pomodoro") || text.includes("odak")) {
      navigation.navigate("FocusTimer");
      return;
    }
    navigation.navigate("MainTabs", { screen: "HomeTab" });
  }

  const displayName = [user?.ad, user?.soyad].filter(Boolean).join(" ").trim() || user?.email || "Öğrenci";

  const listHeader = (
    <>
      <View style={[styles.shellCard, { backgroundColor: palette.topbarBg, borderColor: palette.border }]}>
        <View style={styles.topbarRow}>
          <Pressable style={styles.brandRow} onPress={() => navigation.navigate("MainTabs", { screen: "ProfileTab" })}>
            <Text style={styles.logoEmoji}>📚</Text>
            <Text style={[styles.brandTitle, { color: palette.text }]} numberOfLines={1}>
              Hafıza Akademi
            </Text>
          </Pressable>
          <View style={styles.topbarActions}>
            <Pressable
              style={[styles.roundIconBtn, { borderColor: darkMode ? "rgba(255,255,255,0.2)" : "#e2e8f0" }]}
              onPress={() => navigation.navigate("Notifications")}
            >
              <Text style={styles.roundIconInner}>🔔</Text>
            </Pressable>
            <Pressable
              style={[styles.roundIconBtn, { borderColor: darkMode ? "rgba(255,255,255,0.2)" : "#e2e8f0" }]}
              onPress={toggleDarkMode}
            >
              <Text style={styles.roundIconInner}>{darkMode ? "☀️" : "🌙"}</Text>
            </Pressable>
            <Pressable style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutBtnText}>Çıkış</Text>
            </Pressable>
          </View>
        </View>
        <Pressable onPress={() => navigation.navigate("Search")} style={styles.searchWrap}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: palette.inputBg,
                borderColor: palette.searchBorder,
                color: palette.text,
              },
            ]}
            placeholder="Ders, ünite veya konu ara..."
            placeholderTextColor={palette.muted}
            editable={false}
            pointerEvents="none"
          />
        </Pressable>
      </View>

      <View style={[styles.hero, { backgroundColor: palette.heroBg }]}>
        <Text style={styles.heroTitle}>Derslerim</Text>
        <Text style={styles.heroSubtitle}>Eğitim yolculuğunuza devam edin ve bilginizi test edin</Text>
        <Text style={styles.heroWelcome}>Hoş geldin, {displayName}</Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.statFrost}>
            <Text style={[styles.statFrostValue, { color: colors.success }]}>{stats.correct}</Text>
            <Text style={styles.statFrostLabel}>Doğru</Text>
          </View>
          <View style={styles.statFrost}>
            <Text style={[styles.statFrostValue, { color: colors.accentBlue }]}>%{stats.success}</Text>
            <Text style={styles.statFrostLabel}>Başarı</Text>
          </View>
          <View style={styles.statFrost}>
            <Text style={[styles.statFrostValue, { color: colors.accentCyan }]}>{stats.totalSolved}</Text>
            <Text style={styles.statFrostLabel}>Çözülen</Text>
          </View>
        </View>
        <Text style={styles.heroWeekLine}>
          Bu hafta: {weeklyStats.total} soru · {weeklyStats.correct} doğru · %{weeklyStats.success} başarı
        </Text>
      </View>

      <View style={[styles.shortcutsCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.shortcutsTitle, { color: palette.text }]}>Hızlı erişim</Text>
        <View style={styles.shortcutsWrap}>
          {shortcuts.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleShortcut(item.nav)}
              style={({ pressed }) => [
                styles.shortcutChip,
                {
                  backgroundColor: palette.chipBg,
                  borderColor: palette.chipBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.shortcutEmoji}>{item.emoji}</Text>
              <Text style={[styles.shortcutLabel, { color: palette.text }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <DashboardSection palette={palette} darkMode={darkMode} title="Kaldığın Yerden Devam Et">
        {lastActivity ? (
          <>
            <Text style={[styles.bodyStrong, { color: palette.text }]}>{lastActivity.title || "Son aktivite"}</Text>
            <Text style={[styles.bodyMuted, { color: palette.muted }]}>{lastActivity.subtitle || "Son çalışmana hızlıca geri dön."}</Text>
            <PrimaryButton title="Devam Et" onPress={() => openRecentActivity(lastActivity)} style={{ marginTop: 12 }} />
          </>
        ) : (
          <Text style={[styles.bodyMuted, { color: palette.muted }]}>
            Henüz aktivite yok. Bir test ya da video ile başlayabilirsin.
          </Text>
        )}
      </DashboardSection>

      <DashboardSection palette={palette} darkMode={darkMode} title="📋 Son Aktivitelerim">
        {recentActivities.length === 0 ? (
          <Text style={[styles.bodyMuted, { color: palette.muted }]}>Henüz aktivite kaydı yok.</Text>
        ) : null}
        {recentActivities.slice(0, 5).map((a) => (
          <Pressable
            key={a.id}
            style={[styles.activityRow, { borderBottomColor: palette.border }]}
            onPress={() => openRecentActivity(a)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.activityTitle, { color: palette.text }]}>{a.title}</Text>
              <Text style={[styles.activityMeta, { color: palette.muted }]}>
                {a.subtitle || "-"} · {a.at ? new Date(a.at).toLocaleString("tr-TR") : "-"}
              </Text>
            </View>
            <Text style={styles.activityGo}>Git</Text>
          </Pressable>
        ))}
      </DashboardSection>

      <View
        onLayout={(e) => {
          dersListOffsetY.current = e.nativeEvent.layout.y;
        }}
      >
        <SectionTitle title="Tüm Dersler" subtitle="Ders seçerek çalışmaya başlayın" />
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 14 }}
        nestedScrollEnabled
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
      >
        {listHeader}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : dersler.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.bodyMuted, { color: palette.muted }]}>Ders bulunamadı.</Text>
          </View>
        ) : (
          dersler.map((item) => {
            const perf = getCoursePerf(item);
            const initial = String(item.ad || "?").charAt(0).toUpperCase();
            return (
              <View
                key={String(item.id)}
                style={[styles.dersCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <View style={[styles.dersCardHeader, { borderBottomColor: palette.border, backgroundColor: darkMode ? "#0f172a" : "#f8fafc" }]}>
                  <View style={styles.dersIconRow}>
                    <View style={styles.dersIcon}>
                      <Text style={styles.dersIconText}>{initial}</Text>
                    </View>
                  </View>
                  <View style={styles.dersBadge}>
                    <Text style={styles.dersBadgeText}>DERS</Text>
                  </View>
                </View>
                <View style={styles.dersCardBody}>
                  <Text style={[styles.dersCardTitle, { color: palette.text }]}>{item.ad}</Text>
                  <Text style={[styles.dersCardDesc, { color: darkMode ? "#cbd5e1" : "#374151" }]}>
                    {item.aciklama || "Ders açıklaması yakında eklenecek"}
                  </Text>
                  {perf ? (
                    <View style={[styles.coursePerfBox, { borderColor: palette.border, backgroundColor: darkMode ? "#0f172a" : "#fcfcff" }]}>
                      <View style={styles.coursePerfPills}>
                        <Text style={styles.coursePill}>Başarı %{perf.success}</Text>
                        <Text style={styles.coursePill}>Net {perf.net}</Text>
                        <Text style={styles.coursePill}>{perf.count} oturum</Text>
                      </View>
                      <ProgressBar value={perf.success} height={8} />
                      <Text style={[styles.courseLast, { color: palette.muted }]}>Son çalışma: {formatShortDate(perf.lastAt)}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.courseHint, { color: palette.muted }]}>Bu ders için henüz rapor kaydı yok.</Text>
                  )}
                </View>
                <View style={[styles.dersCardFooter, { borderTopColor: palette.border, backgroundColor: palette.footerBg }]}>
                  <View style={styles.footerBtnRow}>
                    <PrimaryButton title="Teste Başla" style={{ flex: 1 }} onPress={() => navigation.navigate("Quiz", { ders: item })} />
                    <SecondaryButton
                      title="Detaylar"
                      variant="outline"
                      dark={darkMode}
                      style={{ flex: 1 }}
                      onPress={() => navigation.navigate("CourseDetail", { ders: item })}
                    />
                  </View>
                  <View style={[styles.footerBtnRow, { marginTop: 10 }]}>
                    <SecondaryButton
                      title="🎴 Flash"
                      variant="outline"
                      dark={darkMode}
                      style={{ flex: 1 }}
                      onPress={() => navigation.navigate("Flashcards")}
                    />
                    <SecondaryButton
                      title="Videolar"
                      variant="outline"
                      dark={darkMode}
                      style={{ flex: 1 }}
                      onPress={() => navigation.navigate("CourseDetail", { ders: item, initialTab: "videolar" })}
                    />
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardSection({ palette, darkMode, title, children }) {
  return (
    <View style={[styles.dashOuter, { borderColor: palette.border, backgroundColor: palette.card }]}>
      <View style={[styles.dashHead, { borderBottomColor: palette.dashHeadBorder, backgroundColor: darkMode ? "#0f172a" : "#f8fafc" }]}>
        <Text style={[styles.dashTitle, { color: darkMode ? "#e2e8f0" : "#1e293b" }]}>{title}</Text>
      </View>
      <View style={styles.dashBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  shellCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    marginBottom: 12,
  },
  topbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  logoEmoji: { fontSize: 26 },
  brandTitle: { fontSize: 17, fontWeight: "700", flex: 1, minWidth: 0 },
  topbarActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  roundIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  roundIconInner: { fontSize: 20 },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.logout,
  },
  logoutBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchWrap: { width: "100%" },
  searchInput: {
    width: "100%",
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  hero: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 22,
    marginBottom: 12,
    overflow: "hidden",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.95)", fontWeight: "400", marginBottom: 6 },
  heroWelcome: { fontSize: 13, color: "rgba(255,255,255,0.88)", fontWeight: "600", marginBottom: 18 },
  heroStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  heroWeekLine: {
    marginTop: 14,
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    textAlign: "center",
  },
  statFrost: {
    flexGrow: 1,
    flexBasis: "28%",
    minWidth: 88,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statFrostValue: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  statFrostLabel: { fontSize: 11, color: "rgba(255,255,255,0.92)", fontWeight: "600", textAlign: "center" },
  shortcutsCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  shortcutsTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  shortcutsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  shortcutChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    maxWidth: "48%",
    flexGrow: 1,
    minWidth: "42%",
  },
  shortcutEmoji: { fontSize: 16 },
  shortcutLabel: { fontSize: 13, fontWeight: "700", flex: 1 },
  dashOuter: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dashHead: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dashTitle: { fontSize: 16, fontWeight: "700" },
  dashBody: { padding: 16 },
  bodyStrong: { fontWeight: "800", fontSize: 15 },
  bodyMuted: { fontSize: 13, marginTop: 4, lineHeight: 20 },
  activityRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activityTitle: { fontWeight: "700", fontSize: 14 },
  activityMeta: { fontSize: 12, marginTop: 3 },
  activityGo: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 140 },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 12 },
  dersCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dersCardHeader: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dersIconRow: { flexDirection: "row", alignItems: "center" },
  dersIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#667eea",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dersIconText: { color: "#fff", fontWeight: "700", fontSize: 20 },
  dersBadge: {
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dersBadgeText: { color: "#3730a3", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  dersCardBody: { paddingHorizontal: 18, paddingVertical: 16 },
  dersCardTitle: { fontSize: 19, fontWeight: "700", marginBottom: 8, letterSpacing: -0.3 },
  dersCardDesc: { fontSize: 14, lineHeight: 21, marginBottom: 10 },
  coursePerfBox: { marginBottom: 4, borderWidth: 1, borderRadius: 10, padding: 10 },
  coursePerfPills: { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  coursePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  courseLast: { fontSize: 11, marginTop: 6, fontWeight: "600" },
  courseHint: { fontSize: 13, marginBottom: 4 },
  dersCardFooter: { paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1 },
  footerBtnRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
});
