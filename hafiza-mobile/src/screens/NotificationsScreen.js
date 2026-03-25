import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, SectionTitle } from "../components/ui";
import { fetchRaporlar } from "../services/quiz";
import { getJSON } from "../services/storage";
import { colors } from "../theme";

export default function NotificationsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [raporlar, setRaporlar] = useState([]);
  const [focusReward, setFocusReward] = useState({ xp: 0, gold: 0 });
  const [dailyGoals, setDailyGoals] = useState({ solved: 30, correct: 20 });

  useEffect(() => {
    (async () => {
      try {
        const [reports, reward, goals] = await Promise.all([
          fetchRaporlar(100),
          getJSON("focus_rewards", { xp: 0, gold: 0 }),
          getJSON("daily_goals", { solved: 30, correct: 20 }),
        ]);
        setRaporlar(Array.isArray(reports) ? reports : []);
        setFocusReward({ xp: Number(reward?.xp || 0), gold: Number(reward?.gold || 0) });
        setDailyGoals(goals || { solved: 30, correct: 20 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const notifications = useMemo(() => {
    const today = new Date().toLocaleDateString("tr-TR");
    const todays = raporlar.filter((r) => r.finishedAt && new Date(r.finishedAt).toLocaleDateString("tr-TR") === today);
    const solved = todays.reduce((a, r) => a + (r.totalCount || 0), 0);
    const correct = todays.reduce((a, r) => a + (r.correctCount || 0), 0);
    const list = [];

    list.push({
      id: "daily-progress",
      title: "Gunluk Calisma Durumu",
      body: `Soru ${solved}/${dailyGoals.solved} | Dogru ${correct}/${dailyGoals.correct}`,
      go: () => navigation.navigate("Tasks"),
    });

    if (focusReward.xp > 0 || focusReward.gold > 0) {
      list.push({
        id: "focus-reward",
        title: "Odak Odulleri",
        body: `Kazanilan toplam: +${focusReward.xp} XP, +${focusReward.gold} altin`,
        go: () => navigation.navigate("FocusTimer"),
      });
    }

    if (raporlar.length > 0) {
      const latest = raporlar[0];
      list.push({
        id: "latest-report",
        title: "Son Rapor Hazir",
        body: `Dogru ${latest.correctCount || 0} | Toplam ${latest.totalCount || 0}`,
        go: () => navigation.navigate("ReportsTab"),
      });
    }

    list.push({
      id: "weekly-plan",
      title: "Grafiklerini Kontrol Et",
      body: "Performans analizinden zayif alanlarini gor.",
      go: () => navigation.navigate("Insights"),
    });

    list.push({
      id: "video-reminder",
      title: "Konu Videosu ile Tekrar",
      body: "Bugun bir konu videosu acip notlarini guncelle.",
      go: () => navigation.navigate("VideoLessons"),
    });

    return list;
  }, [raporlar, dailyGoals.correct, dailyGoals.solved, focusReward.gold, focusReward.xp, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Card style={styles.topBar}>
        <Pressable onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MainTabs", { screen: "HomeTab" }))}>
          <Text style={styles.backText}>← Geri</Text>
        </Pressable>
      </Card>
      <SectionTitle title="Bildirim Merkezi" subtitle="Calisma durumuna gore oneri ve hatirlatmalar" />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {notifications.map((n) => (
          <Pressable key={n.id} onPress={n.go}>
            <Card style={styles.item}>
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.body}>{n.body}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar: { marginBottom: 8, paddingVertical: 10 },
  backText: { color: colors.primary, fontWeight: "800" },
  item: { marginBottom: 8 },
  title: { color: colors.text, fontWeight: "700" },
  body: { color: colors.muted, marginTop: 3, fontSize: 12 },
});
