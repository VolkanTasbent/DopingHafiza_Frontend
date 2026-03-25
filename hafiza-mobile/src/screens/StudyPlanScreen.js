import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { fetchDersler } from "../services/quiz";
import { getJSON, setJSON } from "../services/storage";
import { colors } from "../theme";

const DAYS = ["Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi", "Pazar"];
const DAY_BY_INDEX = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];

export default function StudyPlanScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dersler, setDersler] = useState([]);
  const [plan, setPlan] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const [courses, savedPlan] = await Promise.all([fetchDersler(), getJSON("weekly_plan", {})]);
        setDersler(Array.isArray(courses) ? courses : []);
        setPlan(savedPlan || {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const defaultCourse = useMemo(() => (dersler[0]?.ad ? String(dersler[0].ad) : ""), [dersler]);

  function updateDay(day, key, value) {
    setPlan((prev) => {
      const current = prev[day] || { course: defaultCourse, target: "40" };
      return { ...prev, [day]: { ...current, [key]: value } };
    });
  }

  async function savePlan() {
    setSaving(true);
    try {
      await setJSON("weekly_plan", plan);
    } finally {
      setSaving(false);
    }
  }

  async function generateTodayTask() {
    const todayKey = DAY_BY_INDEX[new Date().getDay()] || "Pazartesi";
    const planItem = plan[todayKey];
    if (!planItem?.course) {
      Alert.alert("Bilgi", `Bugun (${todayKey}) icin plan kaydi bulunamadi.`);
      return;
    }
    const existing = await getJSON("study_tasks", []);
    const list = Array.isArray(existing) ? existing : [];
    const todayDate = new Date().toLocaleDateString("tr-TR");
    const taskTitle = `${planItem.course} - ${planItem.target || "40"} soru`;
    const duplicate = list.some((t) => String(t.title || "").toLowerCase() === String(taskTitle).toLowerCase() && (t.dueDate || "") === todayDate);
    if (duplicate) {
      Alert.alert("Bilgi", "Bugunun plani zaten gorevlere eklendi.");
      return;
    }
    const task = {
      id: `plan-${Date.now()}`,
      title: taskTitle,
      done: false,
      category: "Plan",
      priority: "Yuksek",
      dueDate: todayDate,
      dueTime: "",
    };
    await setJSON("study_tasks", [task, ...list]);
    Alert.alert("Basarili", "Bugunun plani gorevlere eklendi.");
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Calisma Plani" subtitle="Haftalik ders ve soru hedeflerini planla" />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {DAYS.map((day) => {
          const item = plan[day] || { course: defaultCourse, target: "40" };
          return (
            <Card key={day} style={styles.card}>
              <Text style={styles.day}>{day}</Text>
              <Text style={styles.label}>Ders</Text>
              <TextInput
                value={item.course}
                onChangeText={(v) => updateDay(day, "course", v)}
                placeholder={defaultCourse || "Ders adi"}
                style={styles.input}
              />
              <Text style={styles.label}>Soru hedefi</Text>
              <TextInput
                value={String(item.target)}
                onChangeText={(v) => updateDay(day, "target", v)}
                keyboardType="number-pad"
                style={styles.input}
              />
            </Card>
          );
        })}
        <PrimaryButton title={saving ? "Kaydediliyor..." : "Plani Kaydet"} onPress={savePlan} disabled={saving} />
        <View style={{ marginTop: 8 }}>
          <PrimaryButton title="Bugunluk Plani Gorevlere Ekle" onPress={generateTodayTask} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={styles.note}>
            Ders onerileri: {dersler.map((d) => d.ad).filter(Boolean).slice(0, 6).join(", ") || "Veri yok"}
          </Text>
        </View>
        <View style={{ marginTop: 14 }}>
          <SecondaryButton title="AI haftalik program takvimi" onPress={() => navigation.navigate("CalismaProgrami")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { marginBottom: 10 },
  day: { color: colors.text, fontWeight: "800", marginBottom: 8, fontSize: 15 },
  label: { color: colors.text, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 8 },
  note: { color: colors.muted, fontSize: 12 },
});
