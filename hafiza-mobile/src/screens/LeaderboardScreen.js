import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, SectionTitle } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { fetchRaporlar } from "../services/quiz";
import { getJSON } from "../services/storage";
import { calculateStreakFromReports, computeGamificationStats } from "../services/gamificationData";
import { colors } from "../theme";

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myScore, setMyScore] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [raporlar, focusReward] = await Promise.all([
          fetchRaporlar(200),
          getJSON("focus_rewards", { xp: 0, gold: 0 }),
        ]);
        const streak = calculateStreakFromReports(Array.isArray(raporlar) ? raporlar : []);
        const s = computeGamificationStats(Array.isArray(raporlar) ? raporlar : [], streak, focusReward || { xp: 0, gold: 0 });
        setMyScore(Number(s.xp || 0));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    const seed = [
      { name: "Ayse O.", xp: 5400 },
      { name: "Mert K.", xp: 4950 },
      { name: "Zeynep T.", xp: 4600 },
      { name: "Can A.", xp: 4300 },
      { name: "Elif B.", xp: 4050 },
    ];
    const meName = `${user?.ad || "Sen"} ${user?.soyad || ""}`.trim();
    return [...seed, { name: meName, xp: myScore }].sort((a, b) => b.xp - a.xp).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [myScore, user?.ad, user?.soyad]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Liderlik Tablosu" subtitle="XP siralamasinda yerini gor ve daha yukari cik" />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {rows.map((row) => (
          <Card key={`${row.name}-${row.rank}`} style={[styles.row, row.name.startsWith(user?.ad || "___") && styles.me]}>
            <Text style={styles.rank}>#{row.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{row.name}</Text>
            </View>
            <Text style={styles.xp}>{row.xp} XP</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  me: { borderColor: "#312e81", borderWidth: 2 },
  rank: { color: colors.primary, fontWeight: "800", width: 36 },
  name: { color: colors.text, fontWeight: "700" },
  xp: { color: colors.text, fontWeight: "800" },
});
