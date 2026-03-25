import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SectionTitle } from "../components/ui";
import { getJSON, setJSON } from "../services/storage";
import { colors } from "../theme";

const DEFAULT_TASKS = [
  { id: "t1", title: "30 soru cozum", done: false, category: "Soru", priority: "Orta", dueDate: "", dueTime: "" },
  { id: "t2", title: "1 deneme cozum", done: false, category: "Deneme", priority: "Yuksek", dueDate: "", dueTime: "" },
  { id: "t3", title: "Yanlis analizi", done: false, category: "Analiz", priority: "Orta", dueDate: "", dueTime: "" },
];
const PRIORITIES = ["Dusuk", "Orta", "Yuksek"];
const FILTERS = ["Tum", "Soru", "Deneme", "Analiz", "Tekrar", "Plan"];

export default function TasksScreen({ navigation }) {
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [newTask, setNewTask] = useState("");
  const [newCategory, setNewCategory] = useState("Soru");
  const [newPriority, setNewPriority] = useState("Orta");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [activeFilter, setActiveFilter] = useState("Tum");

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
      <SectionTitle title="Calisma Gorevleri" subtitle="Gorev olustur, tamamla ve gunu takip et" />

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

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <Card style={styles.card}>
          <Text style={styles.h2}>Filtre</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  topBar: { marginBottom: 8, paddingVertical: 10 },
  backText: { color: colors.primary, fontWeight: "800" },
  card: { marginBottom: 10 },
  h2: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 6 },
  meta: { color: colors.muted },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  createRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  priorityBtn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  priorityBtnText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  filterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterChipText: { color: colors.muted, fontWeight: "600", fontSize: 12 },
  filterChipTextActive: { color: colors.primary, fontWeight: "700" },
  taskCard: { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  taskTitle: { color: colors.text, fontWeight: "600" },
  taskMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  taskDone: { textDecorationLine: "line-through", color: colors.muted },
});
