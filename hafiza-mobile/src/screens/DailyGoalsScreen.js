import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, ProgressBar, SectionTitle } from "../components/ui";
import { fetchRaporlar } from "../services/quiz";
import { getJSON, setJSON } from "../services/storage";
import { colors } from "../theme";

const DEFAULT_GOALS = { solved: 30, correct: 20 };

export default function DailyGoalsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [raporlar, setRaporlar] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);

  useEffect(() => {
    (async () => {
      try {
        const [reports, savedGoals] = await Promise.all([fetchRaporlar(200), getJSON("daily_goals", DEFAULT_GOALS)]);
        setRaporlar(Array.isArray(reports) ? reports : []);
        setGoals(savedGoals || DEFAULT_GOALS);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const todayStats = useMemo(() => {
    const today = new Date().toLocaleDateString("tr-TR");
    const todays = raporlar.filter((r) => r.finishedAt && new Date(r.finishedAt).toLocaleDateString("tr-TR") === today);
    const solved = todays.reduce((a, r) => a + (r.totalCount || 0), 0);
    const correct = todays.reduce((a, r) => a + (r.correctCount || 0), 0);
    return { solved, correct };
  }, [raporlar]);

  async function saveGoals() {
    const solved = Math.max(1, Number(goals.solved) || 1);
    const correct = Math.max(1, Number(goals.correct) || 1);
    const payload = { solved, correct };
    setSaving(true);
    try {
      setGoals(payload);
      await setJSON("daily_goals", payload);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const solvedPct = Math.min(100, Math.round((todayStats.solved / Math.max(1, Number(goals.solved))) * 100));
  const correctPct = Math.min(100, Math.round((todayStats.correct / Math.max(1, Number(goals.correct))) * 100));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Gunluk Hedefler" subtitle="Her gun icin net hedef belirle ve takibini yap" />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <Card style={styles.card}>
          <Text style={styles.h2}>Bugunluk Ilerleme</Text>
          <Text style={styles.meta}>Cozulen: {todayStats.solved}/{goals.solved}</Text>
          <ProgressBar value={solvedPct} height={10} />
          <Text style={[styles.meta, { marginTop: 10 }]}>Dogru: {todayStats.correct}/{goals.correct}</Text>
          <ProgressBar value={correctPct} height={10} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Hedef Ayarlari</Text>
          <Text style={styles.label}>Gunluk cozulecek soru</Text>
          <TextInput
            value={String(goals.solved)}
            keyboardType="number-pad"
            onChangeText={(v) => setGoals((p) => ({ ...p, solved: v }))}
            style={styles.input}
          />
          <Text style={styles.label}>Gunluk dogru hedefi</Text>
          <TextInput
            value={String(goals.correct)}
            keyboardType="number-pad"
            onChangeText={(v) => setGoals((p) => ({ ...p, correct: v }))}
            style={styles.input}
          />
          <PrimaryButton title={saving ? "Kaydediliyor..." : "Hedefleri Kaydet"} onPress={saveGoals} disabled={saving} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { marginBottom: 10 },
  h2: { fontWeight: "700", fontSize: 16, marginBottom: 8, color: colors.text },
  meta: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  label: { color: colors.text, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
});
