import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Card, PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { fetchAiStudyPlan } from "../services/quiz";
import { loadSavedPlans } from "../services/aiCoachStorage";
import {
  assignTasksToWeekCalendar,
  loadWeekdayAvailabilityAsync,
  saveWeekdayAvailabilityAsync,
} from "../utils/calismaProgramiSchedule";
import { colors } from "../theme";

const DAY_LABELS = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];

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

export default function CalismaProgramiScreen({ navigation }) {
  const [selectedWeek, setSelectedWeek] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [savedPlans, setSavedPlans] = useState([]);
  const [aiPlan, setAiPlan] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [activeLabel, setActiveLabel] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState("120");
  const [planDays, setPlanDays] = useState("30");
  const [scheduleDailyCap, setScheduleDailyCap] = useState("120");
  const [availableWeekdays, setAvailableWeekdays] = useState([true, true, true, true, true, false, false]);

  useEffect(() => {
    loadWeekdayAvailabilityAsync().then(setAvailableWeekdays);
  }, []);

  const reloadSaved = useCallback(() => {
    loadSavedPlans()
      .then(setSavedPlans)
      .catch(() => setSavedPlans([]));
  }, []);

  const loadAiPlan = useCallback(async () => {
    const days = Math.max(7, Number(planDays) || 30);
    const dm = Math.max(30, Number(dailyMinutes) || 120);
    return fetchAiStudyPlan({ days, dailyMinutes: dm, mode: "mixed" });
  }, [planDays, dailyMinutes]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const dayNum = Math.max(7, Number(planDays) || 30);
        const dm = Math.max(30, Number(dailyMinutes) || 120);
        const [saved, ai] = await Promise.all([
          loadSavedPlans().catch(() => []),
          fetchAiStudyPlan({ days: dayNum, dailyMinutes: dm, mode: "mixed" }).catch(() => null),
        ]);
        if (!alive) return;
        setSavedPlans(saved);
        setAiPlan(ai);
        if (ai?.tasks?.length) {
          setActivePlan(ai);
          setActiveLabel("AI onerisi (guncel)");
          if (ai.dailyMinutes != null) setScheduleDailyCap(String(Number(ai.dailyMinutes) || 120));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sadece ilk acilista; AI yenile butonu guncel parametreleri kullanir
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadSaved();
    }, [reloadSaved])
  );

  const weekStart = useMemo(() => startOfWeekMonday(selectedWeek), [selectedWeek]);
  const capNum = Math.max(30, Math.min(360, Number(scheduleDailyCap) || 120));

  const scheduleResult = useMemo(
    () =>
      assignTasksToWeekCalendar(activePlan?.tasks || [], {
        dailyCapMinutes: capNum,
        availableWeekday: availableWeekdays,
      }),
    [activePlan?.tasks, capNum, availableWeekdays]
  );

  const weekColumns = useMemo(() => {
    const { dayBuckets, minutesUsed, overflowByDay } = scheduleResult;
    return DAY_LABELS.map((dayName, index) => {
      const date = addDays(weekStart, index);
      const isToday = new Date().toDateString() === date.toDateString();
      const list = dayBuckets[index] || [];
      const minutes = minutesUsed[index] ?? 0;
      const overflow = overflowByDay[index] ?? 0;
      const unavailable = !availableWeekdays[index];
      return { dayName, date, isToday, tasks: list, minutes, overflow, unavailable };
    });
  }, [weekStart, scheduleResult, availableWeekdays]);

  const scheduleWarnings = useMemo(() => {
    const overflows = weekColumns.filter((c) => c.overflow > 0);
    const unassigned = scheduleResult.unassigned?.length || 0;
    return { overflows, unassigned };
  }, [weekColumns, scheduleResult.unassigned]);

  const totalWeekMinutes = weekColumns.reduce((s, d) => s + d.minutes, 0);

  const weekRangeText = useMemo(() => {
    const end = addDays(weekStart, 6);
    return {
      start: weekStart.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }),
      end: end.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }),
    };
  }, [weekStart]);

  const onRefreshAi = async () => {
    setLoading(true);
    try {
      const ai = await loadAiPlan();
      setAiPlan(ai);
      if (ai?.tasks?.length) {
        setActivePlan(ai);
        setActiveLabel("AI onerisi (guncel)");
        if (ai.dailyMinutes != null) setScheduleDailyCap(String(Number(ai.dailyMinutes) || 120));
      }
    } catch {
      Alert.alert("Hata", "AI programi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const onSelectSaved = (sp) => {
    setActivePlan({
      summary: sp.summary,
      analyzedDays: sp.days,
      dailyMinutes: sp.dailyMinutes,
      mode: sp.mode,
      tasks: sp.tasks || [],
    });
    setActiveLabel(sp.title || "Kayitli program");
    if (sp.dailyMinutes != null) setScheduleDailyCap(String(Number(sp.dailyMinutes) || 120));
  };

  const toggleWeekday = (index) => {
    setAvailableWeekdays((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      saveWeekdayAvailabilityAsync(next);
      return next;
    });
  };

  const taskTypeStyle = (type) => {
    const t = String(type || "").toLowerCase();
    if (t === "video") return styles.badgeVideo;
    if (t === "quiz") return styles.badgeQuiz;
    if (t === "review") return styles.badgeReview;
    return styles.badgeDefault;
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <SectionTitle
        title="Calisma programi"
        subtitle="Haftalik takvim — oncelik, gunluk limit ve musait gunlere gore"
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <View style={styles.rowWrap}>
            <View style={styles.field}>
              <Text style={styles.label}>Analiz gunu</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={planDays}
                onChangeText={setPlanDays}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Gunluk dk (AI)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={dailyMinutes}
                onChangeText={setDailyMinutes}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Takvim max dk</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={scheduleDailyCap}
                onChangeText={(v) => {
                  const n = Number(v);
                  if (v === "" || Number.isNaN(n)) setScheduleDailyCap(v);
                  else setScheduleDailyCap(String(Math.max(30, Math.min(360, n))));
                }}
              />
            </View>
          </View>
          <View style={styles.btnRow}>
            <PrimaryButton title={loading ? "..." : "AI programini yenile"} onPress={onRefreshAi} disabled={loading} />
            <SecondaryButton title="Kayitlari yenile" onPress={reloadSaved} />
          </View>
          <Text style={styles.activeLine}>
            <Text style={styles.bold}>Aktif:</Text> {activeLabel || "Secilmedi"}
            {activePlan?.summary ? ` — ${activePlan.summary}` : ""}
          </Text>
          <Text style={styles.subLabel}>Musait gunler</Text>
          <View style={styles.chipRow}>
            {DAY_LABELS.map((label, i) => (
              <Pressable
                key={label}
                style={[styles.chip, availableWeekdays[i] ? styles.chipOn : styles.chipOff]}
                onPress={() => toggleWeekday(i)}
              >
                <Text style={[styles.chipText, availableWeekdays[i] ? styles.chipTextOn : styles.chipTextOff]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Kayitli programlar</Text>
          <Text style={styles.hint}>AI Kocum ekranindan kaydedilenler. Secince takvime uygulanir.</Text>
          {savedPlans.length === 0 ? (
            <Text style={styles.muted}>Kayit yok.</Text>
          ) : (
            savedPlans.map((sp) => (
              <Pressable key={sp.id} style={styles.savedItem} onPress={() => onSelectSaved(sp)}>
                <Text style={styles.savedTitle}>{sp.title}</Text>
                <Text style={styles.savedDate}>{sp.savedAt ? new Date(sp.savedAt).toLocaleString("tr-TR") : ""}</Text>
              </Pressable>
            ))
          )}
          {aiPlan?.tasks?.length ? (
            <SecondaryButton
              title="AI onerisine don"
              onPress={() => {
                setActivePlan(aiPlan);
                setActiveLabel("AI onerisi (guncel)");
                if (aiPlan?.dailyMinutes != null) setScheduleDailyCap(String(Number(aiPlan.dailyMinutes) || 120));
              }}
            />
          ) : null}
        </Card>

        <Card style={styles.card}>
          <View style={styles.weekNav}>
            <SecondaryButton title="Onceki" onPress={() => setSelectedWeek((d) => addDays(d, -7))} />
            <View style={styles.weekMid}>
              <Text style={styles.weekRange}>
                {weekRangeText.start} – {weekRangeText.end}
              </Text>
              <Pressable onPress={() => setSelectedWeek(new Date())}>
                <Text style={styles.todayLink}>Bu hafta</Text>
              </Pressable>
            </View>
            <SecondaryButton title="Sonraki" onPress={() => setSelectedWeek((d) => addDays(d, 7))} />
          </View>
          <Text style={styles.summary}>
            Bu hafta toplam: <Text style={styles.bold}>{totalWeekMinutes} dk</Text>
            <Text style={styles.muted}> — Gunluk ust sinir: {capNum} dk</Text>
          </Text>
          <Text style={styles.miniHint}>
            Gorunen haftanin tarihlerine yerlestirilir; haftayi degistirince gorevler o haftaya yeniden dagitilir.
          </Text>
          {(scheduleWarnings.overflows.length > 0 || scheduleWarnings.unassigned > 0) && (
            <View style={styles.warnBox}>
              {scheduleWarnings.overflows.length > 0 ? (
                <Text style={styles.warnText}>
                  Bazı gunler limiti asiyor: {scheduleWarnings.overflows.map((c) => c.dayName).join(", ")}. Musait gun
                  ekleyin veya takvim max yukseltin.
                </Text>
              ) : null}
              {scheduleWarnings.unassigned > 0 ? (
                <Text style={styles.warnText}>{scheduleWarnings.unassigned} gorev yerlestirilemedi.</Text>
              ) : null}
            </View>
          )}
        </Card>

        {loading && !activePlan?.tasks?.length ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {weekColumns.map((col, index) => (
          <Card
            key={index}
            style={[
              styles.dayCard,
              col.isToday && styles.dayToday,
              col.unavailable && styles.dayOff,
              col.overflow > 0 && styles.dayOver,
            ]}
          >
            <View style={styles.dayHead}>
              <Text style={styles.dayName}>
                {col.dayName} {col.date.getDate()}.{col.date.getMonth() + 1}
              </Text>
              {col.isToday ? <Text style={styles.todayBadge}>Bugun</Text> : null}
            </View>
            {col.unavailable ? <Text style={styles.offBadge}>Musait degil</Text> : null}
            {col.minutes > 0 ? (
              <Text style={styles.minutesLine}>
                {col.minutes} dk
                {col.overflow > 0 ? <Text style={styles.overflowTag}> +{col.overflow} tasima</Text> : null}
              </Text>
            ) : null}
            {col.tasks.length === 0 ? (
              <Text style={styles.muted}>{col.unavailable ? "—" : "Plan yok"}</Text>
            ) : (
              col.tasks.map((t, ti) => (
                <View key={`${col.date.toISOString()}-${ti}`} style={styles.taskBox}>
                  <Text style={[styles.typeBadge, taskTypeStyle(t.taskType)]}>{t.taskType || "gorev"}</Text>
                  <Text style={styles.taskTitle}>{t.title}</Text>
                  <Text style={styles.taskMeta}>{t.estimatedMinutes} dk</Text>
                  {t.description ? <Text style={styles.taskDesc}>{t.description}</Text> : null}
                </View>
              ))
            )}
          </Card>
        ))}

        <View style={styles.legend}>
          <Text style={styles.legendItem}>
            <Text style={[styles.dot, { backgroundColor: "#3b82f6" }]} /> video
          </Text>
          <Text style={styles.legendItem}>
            <Text style={[styles.dot, { backgroundColor: "#22c55e" }]} /> quiz
          </Text>
          <Text style={styles.legendItem}>
            <Text style={[styles.dot, { backgroundColor: "#f97316" }]} /> tekrar
          </Text>
        </View>

        <SecondaryButton title="Manuel haftalik plan (ders / soru hedefi)" onPress={() => navigation.navigate("StudyPlan")} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { marginBottom: 10 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  field: { minWidth: "28%", flexGrow: 1 },
  label: { fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    fontSize: 14,
    color: colors.text,
  },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  activeLine: { marginTop: 12, fontSize: 13, color: colors.text, lineHeight: 20 },
  bold: { fontWeight: "800" },
  subLabel: { marginTop: 12, fontSize: 11, fontWeight: "800", color: colors.muted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 2 },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipOff: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0", opacity: 0.75 },
  chipText: { fontSize: 12, fontWeight: "800" },
  chipTextOn: { color: colors.primary },
  chipTextOff: { color: colors.muted },
  h2: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  muted: { fontSize: 13, color: colors.muted },
  savedItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#fafbff",
  },
  savedTitle: { fontWeight: "800", color: colors.text },
  savedDate: { fontSize: 11, color: colors.muted, marginTop: 4 },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  weekMid: { flex: 1, alignItems: "center" },
  weekRange: { fontSize: 12, fontWeight: "700", color: colors.text, textAlign: "center" },
  todayLink: { fontSize: 12, fontWeight: "800", color: colors.primary, marginTop: 4 },
  summary: { fontSize: 14, color: colors.text, marginBottom: 6 },
  miniHint: { fontSize: 11, color: colors.muted, lineHeight: 16 },
  warnBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  warnText: { fontSize: 12, color: "#9a3412", lineHeight: 18 },
  center: { padding: 24, alignItems: "center" },
  dayCard: { marginBottom: 8 },
  dayToday: { borderWidth: 2, borderColor: colors.primary },
  dayOff: { opacity: 0.72, backgroundColor: "#f8fafc" },
  dayOver: { borderWidth: 2, borderColor: "#fb923c" },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  dayName: { fontSize: 15, fontWeight: "800", color: colors.text },
  todayBadge: { fontSize: 10, fontWeight: "800", color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  offBadge: { fontSize: 10, fontWeight: "800", color: colors.muted, marginBottom: 6 },
  minutesLine: { fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 8 },
  overflowTag: { fontSize: 10, fontWeight: "800", color: "#c2410c" },
  taskBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 8,
  },
  typeBadge: {
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
    overflow: "hidden",
  },
  badgeVideo: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  badgeQuiz: { backgroundColor: "#dcfce7", color: "#15803d" },
  badgeReview: { backgroundColor: "#ffedd5", color: "#c2410c" },
  badgeDefault: { backgroundColor: "#e2e8f0", color: "#475569" },
  taskTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  taskMeta: { fontSize: 11, color: colors.muted, marginTop: 2, fontWeight: "600" },
  taskDesc: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginVertical: 14, paddingHorizontal: 4 },
  legendItem: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  dot: { width: 10, height: 10, borderRadius: 2, marginRight: 6 },
});
