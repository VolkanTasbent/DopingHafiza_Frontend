import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SectionTitle } from "../components/ui";
import { fetchDailyTasksSnapshot, syncGamification } from "../services/gamification";
import { getJSON, setJSON } from "../services/storage";
import { useTheme } from "../context/ThemeContext";

const DEFAULT_TASKS = [
  { id: "t1", title: "30 soru cozum", done: false, category: "Soru", priority: "Orta", dueDate: "", dueTime: "" },
  { id: "t2", title: "1 deneme cozum", done: false, category: "Deneme", priority: "Yuksek", dueDate: "", dueTime: "" },
  { id: "t3", title: "Yanlis analizi", done: false, category: "Analiz", priority: "Orta", dueDate: "", dueTime: "" },
];
const PRIORITIES = ["Dusuk", "Orta", "Yuksek"];
const FILTERS = ["Tum", "Soru", "Deneme", "Analiz", "Tekrar", "Plan"];

function createTasksStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 16 },
    topBar: { marginBottom: 8, paddingVertical: 10 },
    backText: { color: c.primary, fontWeight: "800" },
    card: { marginBottom: 10 },
    h2: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 6 },
    meta: { color: c.muted },
    input: {
      backgroundColor: "#fff",
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
    },
    createRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    priorityBtn: {
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: "#c7d2fe",
      borderRadius: 10,
      paddingHorizontal: 10,
      justifyContent: "center",
    },
    priorityBtnText: { color: c.primary, fontWeight: "700", fontSize: 12 },
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    filterChip: { borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
    filterChipActive: { backgroundColor: c.primarySoft, borderColor: c.primary },
    filterChipText: { color: c.muted, fontWeight: "600", fontSize: 12 },
    filterChipTextActive: { color: c.primary, fontWeight: "700" },
    taskCard: { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    taskTitle: { color: c.text, fontWeight: "600" },
    taskMeta: { color: c.muted, fontSize: 12, marginTop: 2 },
    taskDone: { textDecorationLine: "line-through", color: c.muted },
    dailyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    dailyCheck: { fontSize: 22, fontWeight: "800", color: c.primary, minWidth: 28, textAlign: "center" },
    rewardBanner: {
      marginBottom: 10,
      backgroundColor: "#ecfdf5",
      borderColor: "#6ee7b7",
      borderWidth: 1,
    },
    rewardBannerText: { color: "#047857", fontWeight: "700", fontSize: 14 },
  });
}

export default function TasksScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createTasksStyles(colors), [colors]);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [newTask, setNewTask] = useState("");
  const [newCategory, setNewCategory] = useState("Soru");
  const [newPriority, setNewPriority] = useState("Orta");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [activeFilter, setActiveFilter] = useState("Tum");

  const [dailyTasks, setDailyTasks] = useState([]);
  const [dailyStats, setDailyStats] = useState({ solved: 0, correct: 0, sessions: 0 });
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyReady, setDailyReady] = useState(false);
  const [dailyHadServerState, setDailyHadServerState] = useState(false);
  const [dailyMessage, setDailyMessage] = useState("");
  const rewardTimerRef = useRef(null);

  useEffect(() => {
    (async () => {
      const data = await getJSON("study_tasks", DEFAULT_TASKS);
      if (Array.isArray(data)) {
        // Backward compatibility for older saved tasks without category/priority
        setTasks(
          data.map((t) => ({
            ...t,
            category: t.category || "Soru",
            priority: t.priority || "Orta",
            dueDate: t.dueDate || "",
            dueTime: t.dueTime || "",
          }))
        );
      } else {
        setTasks(DEFAULT_TASKS);
      }
    })();
  }, []);

  useEffect(() => {
    setJSON("study_tasks", tasks);
  }, [tasks]);

  useEffect(() => {
    return () => {
      if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
    };
  }, []);

  function showDailyRewardMessage(text) {
    if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
    setDailyMessage(text);
    rewardTimerRef.current = setTimeout(() => {
      setDailyMessage("");
      rewardTimerRef.current = null;
    }, 3500);
  }

  const loadDailyTasks = useCallback(async () => {
    setDailyLoading(true);
    let prevTasks = [];
    let hadPrevSnapshot = false;
    try {
      const snap = await fetchDailyTasksSnapshot();
      prevTasks = snap.tasks;
      hadPrevSnapshot = snap.ok;
    } catch {
      prevTasks = [];
    }
    const { state, earnedPoints, earnedGold } = await syncGamification();
    setDailyLoading(false);
    setDailyReady(true);
    if (!state) {
      setDailyHadServerState(false);
      setDailyTasks([]);
      setDailyStats({ solved: 0, correct: 0, sessions: 0 });
      return;
    }
    setDailyHadServerState(true);
    const mapped = Array.isArray(state.dailyTasks) ? state.dailyTasks : [];
    setDailyTasks(mapped);
    setDailyStats({
      solved: state.solved ?? 0,
      correct: state.correct ?? 0,
      sessions: state.sessions ?? 0,
    });
    const prevDone = prevTasks.filter((t) => t.completed).length;
    const newDone = mapped.filter((t) => t.completed).length;
    if (hadPrevSnapshot && newDone > prevDone) {
      const latest = mapped.find(
        (t) => t.completed && !prevTasks.some((s) => s.id === t.id && s.completed)
      );
      if (latest) {
        showDailyRewardMessage(
          `Gorev tamamlandi: ${latest.title} (+${latest.rewardPoints} puan, +${latest.rewardGold} altin)`
        );
      }
    } else if (hadPrevSnapshot && (earnedPoints > 0 || earnedGold > 0) && newDone === prevDone) {
      showDailyRewardMessage(`Ilerleme kaydedildi (+${earnedPoints} puan, +${earnedGold} altin)`);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDailyTasks();
    }, [loadDailyTasks])
  );

  const completedCount = useMemo(() => tasks.filter((t) => t.done).length, [tasks]);
  const progressPct = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const visibleTasks = useMemo(
    () => (activeFilter === "Tum" ? tasks : tasks.filter((t) => t.category === activeFilter)),
    [tasks, activeFilter]
  );

  function toggleTask(id, done) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
  }

  function cyclePriority() {
    const idx = PRIORITIES.indexOf(newPriority);
    setNewPriority(PRIORITIES[(idx + 1) % PRIORITIES.length]);
  }

  function addTask() {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    setTasks((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        title: trimmed,
        done: false,
        category: newCategory || "Soru",
        priority: newPriority || "Orta",
        dueDate: (newDueDate || "").trim(),
        dueTime: (newDueTime || "").trim(),
      },
    ]);
    setNewTask("");
    setNewDueDate("");
    setNewDueTime("");
  }

  function clearDone() {
    setTasks((prev) => prev.filter((t) => !t.done));
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Card style={styles.topBar}>
        <Pressable onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation.navigate("MainTabs", { screen: "HomeTab" }))}>
          <Text style={styles.backText}>← Geri</Text>
        </Pressable>
      </Card>
      <SectionTitle title="Calisma Gorevleri" subtitle="Gunluk AI gorevleri ve kendi listeni bir arada" />

      {dailyMessage ? (
        <Card style={styles.rewardBanner}>
          <Text style={styles.rewardBannerText}>{dailyMessage}</Text>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.h2}>Gunluk gorevler (sunucu)</Text>
        <Text style={styles.meta}>Calisma istatistiklerine gore otomatik tamamlanir; quiz sonrasi senkron önerilir.</Text>
        {!dailyReady || (dailyLoading && dailyTasks.length === 0) ? (
          <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} />
        ) : null}
        {dailyReady && !dailyLoading && !dailyHadServerState ? (
          <Text style={styles.meta}>Yuklenemedi veya oturum yok. Giris yaptiktan sonra yenileyin.</Text>
        ) : null}
        {dailyReady && dailyHadServerState && dailyTasks.length === 0 ? (
          <Text style={styles.meta}>Bugun icin atanmis gunluk gorev yok.</Text>
        ) : null}
        {dailyTasks.map((task) => {
          const metric = task.metric || "solved";
          const current = dailyStats[metric] ?? 0;
          const target = Number(task.target || 0);
          return (
            <View key={task.id} style={styles.dailyRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskTitle, task.completed && styles.taskDone]}>{task.title}</Text>
                <Text style={styles.taskMeta}>
                  {current}/{target} ({metric})
                </Text>
              </View>
              <Text style={styles.dailyCheck}>{task.completed ? "✓" : "…"}</Text>
            </View>
          );
        })}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.h2}>Bugunluk Ilerleme</Text>
        <Text style={styles.meta}>
          Tamamlanan: {completedCount}/{tasks.length} (%{progressPct})
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.h2}>Yeni Gorev</Text>
        <TextInput
          style={styles.input}
          placeholder="Orn: Trigonometri tekrar"
          value={newTask}
          onChangeText={setNewTask}
        />
        <View style={styles.createRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Kategori (Soru/Deneme/Analiz)"
            value={newCategory}
            onChangeText={setNewCategory}
          />
          <Pressable style={styles.priorityBtn} onPress={cyclePriority}>
            <Text style={styles.priorityBtnText}>Oncelik: {newPriority}</Text>
          </Pressable>
        </View>
        <View style={styles.createRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Tarih (GG.AA.YYYY)"
            value={newDueDate}
            onChangeText={setNewDueDate}
          />
          <TextInput
            style={[styles.input, { width: 110, marginBottom: 0 }]}
            placeholder="Saat (HH:MM)"
            value={newDueTime}
            onChangeText={setNewDueTime}
          />
        </View>
        <PrimaryButton title="Gorev Ekle" onPress={addTask} />
      </Card>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={dailyLoading} onRefresh={loadDailyTasks} colors={[colors.primary]} />}
      >
        <Card style={styles.card}>
          <Text style={styles.h2}>Kendi gorevlerin — filtre</Text>
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable key={f} style={[styles.filterChip, activeFilter === f && styles.filterChipActive]} onPress={() => setActiveFilter(f)}>
                <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {visibleTasks.map((task) => (
          <Card key={task.id} style={styles.taskCard}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskTitle, task.done && styles.taskDone]}>{task.title}</Text>
              <Text style={styles.taskMeta}>
                {task.category || "Soru"} | Oncelik: {task.priority || "Orta"}
              </Text>
              {task.dueDate || task.dueTime ? (
                <Text style={styles.taskMeta}>
                  Plan: {task.dueDate || "--.--.----"} {task.dueTime || "--:--"}
                </Text>
              ) : null}
            </View>
            <Switch value={task.done} onValueChange={(value) => toggleTask(task.id, value)} />
          </Card>
        ))}
        <PrimaryButton title="Tamamlananlari Temizle" onPress={clearDone} />
      </ScrollView>
    </SafeAreaView>
  );
}
