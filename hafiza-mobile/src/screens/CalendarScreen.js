import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Card, SecondaryButton, SectionTitle } from "../components/ui";
import { getJSON } from "../services/storage";
import { fetchPomodoroDailyStats, fetchRaporlarGrafikler } from "../services/quiz";
import { colors } from "../theme";

const DAYS = ["Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi", "Pazar"];
const DAY_BY_INDEX = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];
const WEEK_SHORT = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];

function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatDateLocal(date) {
  const dt = new Date(date);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function normalizeRapor(rapor) {
  let finishedAtDate = null;
  if (rapor?.finishedAt) {
    finishedAtDate = new Date(rapor.finishedAt);
  }
  return {
    oturumId: rapor.oturumId,
    finishedAt: finishedAtDate,
    correctCount: rapor.correctCount || 0,
    wrongCount: rapor.wrongCount || 0,
    emptyCount: rapor.emptyCount || 0,
    durationMs: rapor.durationMs || 0,
    items: Array.isArray(rapor.items) ? rapor.items : [],
  };
}

function reportMinutes(r) {
  if (r.durationMs) return Math.round(Number(r.durationMs) / 60000);
  if (r.items?.length) {
    const ms = r.items.reduce((sum, item) => sum + (Number(item.elapsedMs) || 0), 0);
    return Math.round(ms / 60000);
  }
  return 0;
}

function reportSolved(r) {
  return (r.correctCount || 0) + (r.wrongCount || 0) + (r.emptyCount || 0);
}

function pomodoroFromFocusHistory(history, weekStart) {
  const weekEnd = addDays(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);
  const map = {};
  (Array.isArray(history) ? history : []).forEach((h) => {
    if (!h || h.type !== "Odak" || !h.at) return;
    const d = new Date(h.at);
    if (Number.isNaN(d.getTime()) || d < weekStart || d > weekEnd) return;
    const key = formatDateLocal(d);
    if (!map[key]) map[key] = { count: 0, minutes: 0 };
    map[key].count += 1;
    map[key].minutes += Number(h.minutes) || 0;
  });
  return map;
}

export default function CalendarScreen({ navigation }) {
  const [plan, setPlan] = useState({});
  const [tasks, setTasks] = useState([]);
  const [focusHistory, setFocusHistory] = useState([]);
  const [activities, setActivities] = useState([]);
  const [rangeFilter, setRangeFilter] = useState("7");

  const [selectedWeek, setSelectedWeek] = useState(() => new Date());
  const [raporlar, setRaporlar] = useState([]);
  const [pomodoroDaily, setPomodoroDaily] = useState({});
  const [apiLoading, setApiLoading] = useState(true);

  const loadLocal = useCallback(async () => {
    const [p, t, h, a] = await Promise.all([
      getJSON("weekly_plan", {}),
      getJSON("study_tasks", []),
      getJSON("focus_history", []),
      getJSON("recent_activities", []),
    ]);
    setPlan(p || {});
    setTasks(Array.isArray(t) ? t : []);
    setFocusHistory(Array.isArray(h) ? h : []);
    setActivities(Array.isArray(a) ? a : []);
  }, []);

  const loadApiWeek = useCallback(async () => {
    setApiLoading(true);
    try {
      const raw = await fetchRaporlarGrafikler(500);
      setRaporlar((Array.isArray(raw) ? raw : []).map(normalizeRapor));
    } catch {
      setRaporlar([]);
    }
    try {
      const ws = startOfWeekMonday(selectedWeek);
      const we = addDays(ws, 6);
      const startS = formatDateLocal(ws);
      const endS = formatDateLocal(we);
      let pomMap = await fetchPomodoroDailyStats(startS, endS);
      if (!pomMap || Object.keys(pomMap).length === 0) {
        const hist = await getJSON("focus_history", []);
        pomMap = pomodoroFromFocusHistory(hist, ws);
      }
      setPomodoroDaily(pomMap || {});
    } catch {
      const ws = startOfWeekMonday(selectedWeek);
      const hist = await getJSON("focus_history", []);
      setPomodoroDaily(pomodoroFromFocusHistory(hist, ws));
    } finally {
      setApiLoading(false);
    }
  }, [selectedWeek]);

  useFocusEffect(
    useCallback(() => {
      loadLocal();
      loadApiWeek();
    }, [loadLocal, loadApiWeek])
  );

  const todayName = DAY_BY_INDEX[new Date().getDay()] || "Pazartesi";
  const todayDate = new Date().toLocaleDateString("tr-TR");

  const weeklyData = useMemo(() => {
    const weekStart = startOfWeekMonday(selectedWeek);
    return WEEK_SHORT.map((dayName, index) => {
      const dayDate = addDays(weekStart, index);
      const dayDateStr = formatDateLocal(dayDate);
      const dayReports = raporlar.filter((r) => {
        if (!r.finishedAt) return false;
        return formatDateLocal(r.finishedAt) === dayDateStr;
      });
      let totalMinutes = dayReports.reduce((s, r) => s + reportMinutes(r), 0);
      const pom = pomodoroDaily[dayDateStr];
      if (pom?.minutes) totalMinutes += Number(pom.minutes) || 0;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return {
        dayName,
        date: dayDate,
        hours,
        minutes,
        totalMinutes,
        reports: dayReports.length,
        solved: dayReports.reduce((s, r) => s + reportSolved(r), 0),
        pomodoroCount: pom?.count || 0,
      };
    });
  }, [raporlar, selectedWeek, pomodoroDaily]);

  const weekRangeText = useMemo(() => {
    const ws = startOfWeekMonday(selectedWeek);
    const we = addDays(ws, 6);
    return {
      start: ws.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }),
      end: we.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }),
    };
  }, [selectedWeek]);

  const totalWeekHours = weeklyData.reduce((sum, d) => sum + d.hours + d.minutes / 60, 0);
  const maxBarMinutes = Math.max(1, ...weeklyData.map((d) => d.totalMinutes));

  const todaySummary = useMemo(() => {
    const planned = plan[todayName] || null;
    const dueTasks = tasks.filter((t) => (t.dueDate || "") === todayDate);
    const focusCount = focusHistory.filter(
      (h) => h.type === "Odak" && new Date(h.at).toLocaleDateString("tr-TR") === todayDate
    ).length;
    return { planned, dueTasks, focusCount };
  }, [plan, tasks, focusHistory, todayDate, todayName]);

  const filtered = useMemo(() => {
    const inRange = (date) => {
      if (rangeFilter === "all") return true;
      if (!date) return false;
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return false;
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - Number(rangeFilter));
      return d >= from;
    };
    const parseTaskDate = (value) => {
      if (!value) return null;
      if (String(value).includes(".")) {
        const parts = String(value).split(".").map(Number);
        const [dd, mm, yyyy] = parts;
        if (dd && mm && yyyy) return new Date(yyyy, mm - 1, dd);
      }
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const filteredTasks = tasks.filter((t) => inRange(parseTaskDate(t?.dueDate)));
    const filteredFocus = focusHistory
      .filter((h) => inRange(h?.at))
      .sort((a, b) => new Date(b?.at || 0) - new Date(a?.at || 0))
      .slice(0, 12);
    const filteredActivities = activities
      .filter((a) => inRange(a?.at))
      .sort((a, b) => new Date(b?.at || 0) - new Date(a?.at || 0))
      .slice(0, 20);
    return { filteredTasks, filteredFocus, filteredActivities };
  }, [tasks, focusHistory, activities, rangeFilter]);

  const timeline = useMemo(() => {
    const taskItems = filtered.filteredTasks.map((t) => ({
      at: (() => {
        if (!t?.dueDate) return null;
        if (String(t.dueDate).includes(".")) {
          const parts = String(t.dueDate).split(".").map(Number);
          const [dd, mm, yyyy] = parts;
          return dd && mm && yyyy ? new Date(yyyy, mm - 1, dd, 12, 0, 0).toISOString() : null;
        }
        try {
          return new Date(t.dueDate).toISOString();
        } catch {
          return null;
        }
      })(),
      label: t?.title || "Gorev",
      detail: t?.done ? "Gorev tamamlandi" : "Gorev bekliyor",
      type: "gorev",
    }));
    const focusItems = filtered.filteredFocus.map((h) => ({
      at: h?.at || null,
      label: h?.type || "Odak",
      detail: "Odak gecmisi",
      type: "odak",
    }));
    const actItems = filtered.filteredActivities.map((a) => ({
      at: a?.at || null,
      label: a?.title || "Aktivite",
      detail: a?.subtitle || "-",
      type: a?.type || "aktivite",
    }));
    return [...taskItems, ...focusItems, ...actItems]
      .filter((x) => !!x.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 30);
  }, [filtered]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle
        title="Calisma takvimi"
        subtitle="Sunucudaki oturumlar, pomodoro ve yerel plan — haftalik gorunum"
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <Card style={styles.card}>
          <Text style={styles.h2}>Hafta</Text>
          <View style={styles.weekNav}>
            <Pressable style={styles.navBtn} onPress={() => setSelectedWeek((d) => addDays(d, -7))}>
              <Text style={styles.navBtnText}>Onceki</Text>
            </Pressable>
            <View style={styles.weekMid}>
              <Text style={styles.weekRange}>
                {weekRangeText.start} – {weekRangeText.end}
              </Text>
              <Pressable onPress={() => setSelectedWeek(new Date())}>
                <Text style={styles.todayLink}>Bu hafta</Text>
              </Pressable>
            </View>
            <Pressable style={styles.navBtn} onPress={() => setSelectedWeek((d) => addDays(d, 7))}>
              <Text style={styles.navBtnText}>Sonraki</Text>
            </Pressable>
          </View>
          {apiLoading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.meta}>Raporlar yukleniyor...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.summaryBig}>
                Toplam: <Text style={styles.summaryStrong}>{totalWeekHours.toFixed(1)} saat</Text>
                {" · "}
                {weeklyData.reduce((s, d) => s + d.reports, 0)} oturum · {weeklyData.reduce((s, d) => s + d.solved, 0)} soru
              </Text>
              <Text style={styles.miniHint}>Pomodoro: API veya cihazdaki odak gecmisi ile gunlere eklenir.</Text>
            </>
          )}
        </Card>

        <View style={styles.dayGrid}>
          {weeklyData.map((day, index) => {
            const isToday = new Date().toDateString() === day.date.toDateString();
            const has = day.totalMinutes > 0 || day.reports > 0;
            return (
              <View
                key={index}
                style={[styles.dayCell, isToday && styles.dayCellToday, has && styles.dayCellActive]}
              >
                <View style={styles.dayCellHead}>
                  <Text style={styles.dayCellName}>{day.dayName}</Text>
                  <Text style={styles.dayCellNum}>{day.date.getDate()}</Text>
                </View>
                {has ? (
                  <>
                    <Text style={styles.dayCellTime}>
                      {day.hours > 0 ? `${day.hours} sa ` : ""}
                      {day.minutes > 0 ? `${day.minutes} dk` : day.hours === 0 ? "0 dk" : ""}
                    </Text>
                    <Text style={styles.dayCellMeta}>
                      {day.reports} oturum · {day.solved} soru
                    </Text>
                    {day.pomodoroCount > 0 ? (
                      <Text style={styles.pomoLine}>🍅 {day.pomodoroCount} odak</Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.dayEmpty}>Calisma yok</Text>
                )}
              </View>
            );
          })}
        </View>

        <Card style={styles.card}>
          <Text style={styles.h2}>Haftalik calisma (cubuk)</Text>
          <View style={styles.barChart}>
            {weeklyData.map((d, i) => (
              <View key={`bar-${i}`} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.max(6, (d.totalMinutes / maxBarMinutes) * 100)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{d.dayName}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ marginBottom: 10 }}>
          <SecondaryButton title="AI calisma programi takvimi" onPress={() => navigation.navigate("CalismaProgrami")} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.h2}>Zaman filtresi (yerel)</Text>
          <View style={styles.filterRow}>
            <Pressable style={[styles.filterChip, rangeFilter === "7" && styles.filterChipActive]} onPress={() => setRangeFilter("7")}>
              <Text style={[styles.filterText, rangeFilter === "7" && styles.filterTextActive]}>Son 7 gun</Text>
            </Pressable>
            <Pressable style={[styles.filterChip, rangeFilter === "30" && styles.filterChipActive]} onPress={() => setRangeFilter("30")}>
              <Text style={[styles.filterText, rangeFilter === "30" && styles.filterTextActive]}>Son 30 gun</Text>
            </Pressable>
            <Pressable style={[styles.filterChip, rangeFilter === "all" && styles.filterChipActive]} onPress={() => setRangeFilter("all")}>
              <Text style={[styles.filterText, rangeFilter === "all" && styles.filterTextActive]}>Tumu</Text>
            </Pressable>
          </View>
          <Text style={styles.meta}>
            Gorev: {filtered.filteredTasks.length} | Odak: {filtered.filteredFocus.length} | Aktivite:{" "}
            {filtered.filteredActivities.length}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Bugun ({todayName})</Text>
          <Text style={styles.meta}>Tarih: {todayDate}</Text>
          <Text style={styles.meta}>
            Plan: {todaySummary.planned?.course || "-"} | Hedef: {todaySummary.planned?.target || "-"} soru
          </Text>
          <Text style={styles.meta}>Bugun gorev: {todaySummary.dueTasks.length}</Text>
          <Text style={styles.meta}>Odak seansi: {todaySummary.focusCount}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Haftalik plan (yerel)</Text>
          {DAYS.map((d) => {
            const p = plan[d] || {};
            return (
              <View key={d} style={styles.row}>
                <Text style={styles.day}>{d}</Text>
                <Text style={styles.dayMeta}>
                  {p.course || "-"} {p.target ? `| ${p.target} soru` : ""}
                </Text>
              </View>
            );
          })}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Filtrelenmis gorevler</Text>
          {filtered.filteredTasks.length === 0 ? <Text style={styles.meta}>Secili aralikta gorev yok.</Text> : null}
          {filtered.filteredTasks.slice(0, 12).map((t, idx) => (
            <View key={`${t?.id || t?.title || "task"}-${idx}`} style={styles.row}>
              <Text style={styles.day}>{t?.title || "Gorev"}</Text>
              <Text style={styles.dayMeta}>
                Son tarih: {t?.dueDate || "-"} | {t?.done ? "Tamamlandi" : "Bekliyor"}
              </Text>
            </View>
          ))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Filtrelenmis odak gecmisi</Text>
          {filtered.filteredFocus.length === 0 ? <Text style={styles.meta}>Secili aralikta odak kaydi yok.</Text> : null}
          {filtered.filteredFocus.map((h, idx) => (
            <View key={`${h?.at || "focus"}-${idx}`} style={styles.row}>
              <Text style={styles.day}>{h?.type || "Odak"}</Text>
              <Text style={styles.dayMeta}>{h?.at ? new Date(h.at).toLocaleString("tr-TR") : "-"}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Birlesik zaman cizelgesi</Text>
          {timeline.length === 0 ? <Text style={styles.meta}>Secili aralikta olay yok.</Text> : null}
          {timeline.map((item, idx) => (
            <View key={`${item.at}-${idx}`} style={styles.row}>
              <Text style={styles.day}>{item.label}</Text>
              <Text style={styles.dayMeta}>
                {item.detail} | {new Date(item.at).toLocaleString("tr-TR")}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { marginBottom: 10 },
  h2: { color: colors.text, fontWeight: "800", fontSize: 16, marginBottom: 8 },
  meta: { color: colors.muted, marginBottom: 4, fontSize: 13 },
  row: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 6 },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: colors.primary },
  day: { color: colors.text, fontWeight: "700" },
  dayMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navBtnText: { fontSize: 12, fontWeight: "800", color: colors.primary },
  weekMid: { flex: 1, alignItems: "center" },
  weekRange: { fontSize: 12, fontWeight: "700", color: colors.text, textAlign: "center" },
  todayLink: { fontSize: 12, fontWeight: "800", color: colors.primary, marginTop: 4 },
  loader: { paddingVertical: 16, alignItems: "center" },
  summaryBig: { fontSize: 14, color: colors.text, marginTop: 10, lineHeight: 20 },
  summaryStrong: { fontWeight: "800", color: colors.primary },
  miniHint: { fontSize: 11, color: colors.muted, marginTop: 6, lineHeight: 16 },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10, justifyContent: "space-between" },
  dayCell: {
    width: "31%",
    minWidth: 100,
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 4,
  },
  dayCellToday: { borderColor: colors.primary, borderWidth: 2 },
  dayCellActive: { backgroundColor: "#f8faff" },
  dayCellHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  dayCellName: { fontSize: 12, fontWeight: "800", color: colors.text },
  dayCellNum: { fontSize: 12, fontWeight: "800", color: colors.muted },
  dayCellTime: { fontSize: 13, fontWeight: "800", color: colors.primary, marginBottom: 4 },
  dayCellMeta: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  pomoLine: { fontSize: 10, color: colors.muted, marginTop: 4, fontWeight: "600" },
  dayEmpty: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  barChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120, gap: 4, paddingTop: 8 },
  barCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  barTrack: {
    width: "70%",
    maxWidth: 32,
    height: 88,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", backgroundColor: colors.primary, borderRadius: 6, minHeight: 6 },
  barLabel: { fontSize: 9, fontWeight: "700", color: colors.muted, marginTop: 6, textAlign: "center" },
});
