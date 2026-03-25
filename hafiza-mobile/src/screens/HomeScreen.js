import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchDersler, fetchRaporlar } from "../services/quiz";
import { useAuth } from "../context/AuthContext";
import { Card, PrimaryButton, ProgressBar, SecondaryButton, SectionTitle } from "../components/ui";
import { colors } from "../theme";
import { getRecentActivities } from "../services/activity";
import { useUiPrefs } from "../context/UiPrefsContext";

const QUICK_ACTIONS = [
  { id: "notif", icon: "🔔", label: "Bildirimler", color: "#f59e0b", action: "Notifications" },
  { id: "search", icon: "🔎", label: "Arama", color: "#6366f1", action: "Search" },
  { id: "video", icon: "▶️", label: "Konu Video", color: "#ef4444", action: "VideoLessons" },
  { id: "profil", icon: "👤", label: "Profil", color: "#14b8a6", action: "ProfileTab" },
  { id: "puan", icon: "🏆", label: "Gamification", color: "#0ea5e9", action: "GameTab" },
];

const HOME_TILES = [
  { id: "coz", title: "SORU COZ", icon: "📝", bg: "#ffffff", action: "quiz" },
  { id: "deneme", title: "DENEME SINAVLARI", icon: "✅", bg: "#ffffff", action: "DenemeTab" },
  { id: "rapor", title: "RAPORLARIM", icon: "📊", bg: "#ffffff", action: "ReportsTab" },
  { id: "grafik", title: "GRAFIKLERIM", icon: "📉", bg: "#ffffff", action: "Insights" },
  { id: "gorev", title: "GOREVLER", icon: "🎯", bg: "#ffffff", action: "Tasks" },
  { id: "rozet", title: "ROZET KOLEKSIYONU", icon: "🏅", bg: "#ffffff", action: "Badges" },
  { id: "takvim", title: "TAKVIM", icon: "📅", bg: "#ffffff", action: "Calendar" },
  { id: "calisma", title: "CALISMA PROGRAMI", icon: "📋", bg: "#ffffff", action: "CalismaProgrami" },
  { id: "pomodoro", title: "POMODORO", icon: "🍅", bg: "#ffffff", action: "FocusTimer" },
  { id: "flash", title: "FLASH CARD", icon: "🧠", bg: "#ffffff", action: "flash" },
  { id: "ai", title: "AI KOCUM", icon: "🤖", bg: "#ffffff", action: "AiCoach" },
];
const TILE_ACCENTS = {
  coz: "#4a54ff",
  deneme: "#0ea5e9",
  rapor: "#14b8a6",
  grafik: "#f59e0b",
  gorev: "#f97316",
  rozet: "#e11d48",
  takvim: "#8b5cf6",
  calisma: "#6366f1",
  pomodoro: "#ef4444",
  flash: "#10b981",
  ai: "#111827",
};
const MOBILE_BUILD_TAG = "mobile-build-2026-03-08-01";

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useUiPrefs();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dersler, setDersler] = useState([]);
  const [raporlar, setRaporlar] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

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
      Alert.alert("Hata", "Dersler alinamadi.");
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

  const courseStats = useMemo(() => {
    const map = {};
    raporlar.forEach((r) => {
      const id = r?.dersId || r?.ders?.id || r?.courseId || null;
      const name = r?.dersAd || r?.dersAdi || r?.ders?.ad || "Genel";
      const key = String(id || name);
      if (!map[key]) map[key] = { id, name, total: 0, correct: 0 };
      map[key].total += Number(r.totalCount || 0);
      map[key].correct += Number(r.correctCount || 0);
    });
    return Object.values(map)
      .map((x) => ({ ...x, success: x.total > 0 ? Math.round((x.correct / x.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
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
        Alert.alert("Bilgi", "Soru cozmek icin once ders bulunmali.");
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
    navigation.navigate(action);
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
      navigation.navigate("DenemeTab");
      return;
    }
    if (text.includes("rapor")) {
      navigation.navigate("ReportsTab");
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

  const listHeader = (
    <>
      <View style={styles.topBar}>
        <Text style={styles.menuIcon}>☰</Text>
        <Text style={styles.topBrand}>Doping Hafiza</Text>
        <Pressable style={styles.modeBtn} onPress={toggleDarkMode}>
          <Text style={styles.modeBtnText}>{darkMode ? "☀️" : "🌙"}</Text>
        </Pressable>
        <PrimaryButton title="Cikis" onPress={logout} style={styles.logoutBtn} />
      </View>
      <Pressable onPress={() => navigation.navigate("Search")}>
        <Card style={styles.searchTapBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Ders, deneme, rapor, konu ara..."
            editable={false}
            pointerEvents="none"
          />
        </Card>
      </Pressable>
      <Text style={styles.buildTag}>{MOBILE_BUILD_TAG}</Text>

      <Text style={styles.helloText}>Hos geldin, {user?.ad || user?.email || "Kullanici"}</Text>

      <Card style={styles.roundActionsCard}>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((item) => (
            <Pressable key={item.id} style={styles.actionItem} onPress={() => navigateTo(item.action)}>
              <View style={[styles.actionCircle, { backgroundColor: item.color }]}>
                <Text style={styles.actionIcon}>{item.icon}</Text>
              </View>
              <Text style={styles.actionLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={styles.statsPanel}>
        <View style={styles.statsRow}>
          <View style={styles.ringItem}>
            <View style={styles.ring}>
              <Text style={styles.ringCenter}>{stats.success}%</Text>
            </View>
            <Text style={styles.ringLabel}>Basari</Text>
          </View>
          <View style={styles.ringItem}>
            <View style={styles.ring}>
              <Text style={styles.ringCenter}>{stats.totalSolved}</Text>
            </View>
            <Text style={styles.ringLabel}>Toplam Soru</Text>
          </View>
          <View style={styles.ringItem}>
            <View style={styles.ring}>
              <Text style={styles.ringCenter}>{stats.correct}</Text>
            </View>
            <Text style={styles.ringLabel}>Toplam Dogru</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.continueCard}>
        <Text style={styles.quickTitle}>Kaldigin Yerden Devam Et</Text>
        {lastActivity ? (
          <>
            <Text style={styles.continueTitle}>{lastActivity.title || "Son aktivite"}</Text>
            <Text style={styles.continueMeta}>{lastActivity.subtitle || "Son calismana hizlica geri don."}</Text>
            <PrimaryButton title="Devam Et" onPress={() => openRecentActivity(lastActivity)} style={{ marginTop: 8 }} />
          </>
        ) : (
          <Text style={styles.emptyAct}>Henüz aktivite yok. Bir test ya da video ile baslayabilirsin.</Text>
        )}
      </Card>

      <Card style={styles.weekCard}>
        <Text style={styles.quickTitle}>Bu Hafta Performansim</Text>
        <View style={styles.weekRow}>
          <Text style={styles.weekLabel}>Cozulen Soru</Text>
          <Text style={styles.weekVal}>{weeklyStats.total}</Text>
        </View>
        <View style={styles.weekRow}>
          <Text style={styles.weekLabel}>Dogru Sayisi</Text>
          <Text style={styles.weekVal}>{weeklyStats.correct}</Text>
        </View>
        <View style={styles.weekRow}>
          <Text style={styles.weekLabel}>Basari</Text>
          <Text style={styles.weekVal}>%{weeklyStats.success}</Text>
        </View>
        <ProgressBar value={weeklyStats.success} height={9} />
      </Card>

      <View style={styles.gridWrap}>
        {HOME_TILES.map((tile) => (
          <Pressable
            key={tile.id}
            style={[
              styles.tileCard,
              { backgroundColor: tile.bg, borderColor: `${TILE_ACCENTS[tile.id] || colors.primary}22` },
              tile.id === "ai" ? styles.aiTile : null,
            ]}
            onPress={() => navigateTo(tile.action)}
          >
            <View style={styles.tileInner}>
              <View style={[styles.tileIconWrap, { backgroundColor: `${TILE_ACCENTS[tile.id] || colors.primary}1A` }]}>
                <Text style={styles.tileIcon}>{tile.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tileText, tile.textLight ? styles.tileTextLight : null]}>{tile.title}</Text>
                {tile.id === "ai" ? <Text style={styles.aiTileSub}>Kisisel calisma plani</Text> : null}
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <Card style={styles.activityCard}>
        <Text style={styles.quickTitle}>Son Aktivitelerim</Text>
        {recentActivities.length === 0 ? <Text style={styles.emptyAct}>Henuz aktivite kaydi yok.</Text> : null}
        {recentActivities.map((a) => (
          <Pressable key={a.id} style={styles.activityRow} onPress={() => openRecentActivity(a)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityTitle}>{a.title}</Text>
              <Text style={styles.activityMeta}>
                {a.subtitle || "-"} | {a.at ? new Date(a.at).toLocaleString("tr-TR") : "-"}
              </Text>
            </View>
            <Text style={styles.activityGo}>Git</Text>
          </Pressable>
        ))}
      </Card>

      <Card style={styles.activityCard}>
        <Text style={styles.quickTitle}>Ders Bazli Basari</Text>
        {courseStats.length === 0 ? <Text style={styles.emptyAct}>Ders bazli performans icin henuz veri yok.</Text> : null}
        {courseStats.map((c) => (
          <View key={String(c.id || c.name)} style={styles.coursePerfRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.coursePerfHead}>
                <Text style={styles.coursePerfName}>{c.name}</Text>
                <Text style={styles.coursePerfMeta}>
                  %{c.success} ({c.correct}/{c.total})
                </Text>
              </View>
              <View style={styles.coursePerfTrack}>
                <View style={[styles.coursePerfFill, { width: `${c.success}%` }]} />
              </View>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle title="Derslerim" subtitle="Web frontenddeki ders bolumleriyle uyumlu" />
    </>
  );

  return (
    <SafeAreaView style={[styles.container, darkMode && { backgroundColor: "#0f172a" }]} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 22 }}
        nestedScrollEnabled
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
      >
        {listHeader}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : dersler.length === 0 ? (
          <Card>
            <Text style={styles.emptyAct}>Ders bulunamadi.</Text>
          </Card>
        ) : (
          dersler.map((item) => (
            (() => {
              const perf = getCoursePerf(item);
              return (
                <Card key={String(item.id)} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.ad}</Text>
                  <Text style={styles.cardDesc}>{item.aciklama || "Ders aciklamasi bulunmuyor."}</Text>
                  {perf ? (
                    <View style={styles.coursePerfBox}>
                      <View style={styles.coursePerfPills}>
                        <Text style={styles.coursePill}>Basari %{perf.success}</Text>
                        <Text style={styles.coursePill}>Net {perf.net}</Text>
                        <Text style={styles.coursePill}>{perf.count} Oturum</Text>
                      </View>
                      <ProgressBar value={perf.success} height={8} />
                      <Text style={styles.courseLast}>Son calisma: {formatShortDate(perf.lastAt)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.courseHint}>Bu ders icin henuz rapor kaydi yok.</Text>
                  )}
                  <View style={styles.courseRow}>
                    <PrimaryButton title="Teste Basla" style={{ flex: 1 }} onPress={() => navigation.navigate("Quiz", { ders: item })} />
                    <SecondaryButton title="Ders Detay" style={{ flex: 1 }} onPress={() => navigation.navigate("CourseDetail", { ders: item })} />
                  </View>
                  <View style={styles.courseRowSmall}>
                    <SecondaryButton
                      title="Konu Videolari"
                      style={{ flex: 1 }}
                      onPress={() => navigation.navigate("CourseDetail", { ders: item, initialTab: "videolar" })}
                    />
                  </View>
                </Card>
              );
            })()
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f4f8", paddingHorizontal: 14 },
  topBar: {
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: "#1f2937",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  menuIcon: { color: "#fff", fontSize: 18, marginRight: 10, fontWeight: "800" },
  topBrand: { flex: 1, color: "#fff", fontSize: 21, fontWeight: "800" },
  modeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  modeBtnText: { fontSize: 14 },
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", paddingVertical: 8 },
  searchTapBox: { marginBottom: 8, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8faff" },
  searchInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.muted },
  helloText: { color: colors.text, fontWeight: "700", marginBottom: 8, marginLeft: 2 },
  buildTag: { color: colors.muted, fontSize: 10, marginBottom: 8, marginLeft: 2, fontWeight: "700", backgroundColor: "#eef2ff", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  roundActionsCard: { marginBottom: 10, paddingVertical: 12, backgroundColor: "#fff" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  actionItem: { width: "19%", minWidth: 62, alignItems: "center" },
  actionCircle: { width: 58, height: 58, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontSize: 11, textAlign: "center", color: colors.text, fontWeight: "700" },
  statsPanel: { marginBottom: 10, paddingVertical: 12 },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  ringItem: { width: "32%", alignItems: "center" },
  ring: {
    width: 84,
    height: 84,
    borderRadius: 999,
    borderWidth: 11,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  ringCenter: { color: colors.text, fontWeight: "800", fontSize: 14 },
  ringLabel: { marginTop: 8, color: colors.text, fontWeight: "700", fontSize: 12, textAlign: "center" },
  gridWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 10 },
  tileCard: {
    width: "48.6%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: "#fff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tileInner: { flexDirection: "row", alignItems: "center" },
  tileIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 8 },
  tileIcon: { fontSize: 22 },
  tileText: { flex: 1, color: colors.text, fontWeight: "800", fontSize: 13 },
  tileTextLight: { color: "#fff" },
  aiTile: { borderColor: "#11182733", backgroundColor: "#f8f9ff" },
  aiTileSub: { marginTop: 2, color: colors.muted, fontSize: 11, fontWeight: "600" },
  activityCard: { marginBottom: 12 },
  continueCard: { marginBottom: 10 },
  continueTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  continueMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  weekCard: { marginBottom: 10 },
  weekRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  weekLabel: { color: colors.muted, fontWeight: "600", fontSize: 12 },
  weekVal: { color: colors.text, fontWeight: "800", fontSize: 12 },
  quickTitle: { fontWeight: "800", color: colors.text, marginBottom: 8, fontSize: 15 },
  emptyAct: { color: colors.muted, fontSize: 12 },
  activityRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activityTitle: { color: colors.text, fontWeight: "700" },
  activityMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  activityGo: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  coursePerfRow: { marginBottom: 10 },
  coursePerfHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5, gap: 8 },
  coursePerfName: { color: colors.text, fontWeight: "700", fontSize: 13, flex: 1 },
  coursePerfMeta: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  coursePerfTrack: { height: 8, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden" },
  coursePerfFill: { height: "100%", backgroundColor: colors.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 150 },
  card: { marginBottom: 10 },
  courseRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  courseRowSmall: { flexDirection: "row", gap: 8, marginTop: 8 },
  coursePerfBox: { marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 8, backgroundColor: "#fcfcff" },
  coursePerfPills: { flexDirection: "row", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  coursePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primarySoft, color: colors.primary, fontSize: 11, fontWeight: "700" },
  courseLast: { color: colors.muted, fontSize: 11, marginTop: 6, fontWeight: "600" },
  courseHint: { color: colors.muted, fontSize: 12, marginBottom: 10 },
  cardTitle: { fontWeight: "800", fontSize: 16, marginBottom: 6, color: colors.text },
  cardDesc: { color: colors.muted, marginBottom: 12 },
});
