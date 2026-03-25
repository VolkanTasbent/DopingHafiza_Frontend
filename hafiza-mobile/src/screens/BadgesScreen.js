import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, ProgressBar, SectionTitle } from "../components/ui";
import { fetchRaporlar } from "../services/quiz";
import { BADGE_CATEGORIES, calculateStreakFromReports, computeGamificationStats } from "../services/gamificationData";
import { getJSON } from "../services/storage";
import { colors } from "../theme";

export default function BadgesScreen() {
  const [loading, setLoading] = useState(true);
  const [raporlar, setRaporlar] = useState([]);
  const [focusBonus, setFocusBonus] = useState({ xp: 0, gold: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [data, focusReward] = await Promise.all([
          fetchRaporlar(200),
          getJSON("focus_rewards", { xp: 0, gold: 0 }),
        ]);
        setRaporlar(Array.isArray(data) ? data : []);
        setFocusBonus({ xp: Number(focusReward?.xp || 0), gold: Number(focusReward?.gold || 0) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const streak = useMemo(() => calculateStreakFromReports(raporlar), [raporlar]);
  const stats = useMemo(() => computeGamificationStats(raporlar, streak, focusBonus), [raporlar, streak, focusBonus]);

  const grouped = useMemo(() => {
    const values = {
      xp: stats.xp || 0,
      daily: stats.dailySolved || 0,
      accuracy: stats.totalCorrect || 0,
      streak,
    };
    const out = {};
    Object.entries(BADGE_CATEGORIES).forEach(([key, group]) => {
      out[key] = group.badges.map((badge) => {
        const current = values[key] || 0;
        const earned = stats.earnedBadgeIds.includes(badge.id);
        const percent = Math.max(0, Math.min(100, Math.round((current / badge.target) * 100)));
        return { ...badge, current, earned, percent };
      });
    });
    return out;
  }, [stats, streak]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Rozetlerim" subtitle="Tum rozet kategorilerinde ilerleme durumu" />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {Object.entries(BADGE_CATEGORIES).map(([key, cat]) => (
          <Card key={key} style={styles.card}>
            <Text style={styles.h2}>{cat.name}</Text>
            {grouped[key].map((badge) => (
              <View key={badge.id} style={styles.badgeRow}>
                <Text style={styles.badgeName}>
                  {badge.label} {badge.earned ? "(Kazanildi)" : ""}
                </Text>
                <ProgressBar value={badge.percent} height={8} />
                <Text style={styles.badgeMeta}>{badge.earned ? "Tamam" : `${badge.current}/${badge.target}`}</Text>
              </View>
            ))}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { marginBottom: 10 },
  h2: { fontWeight: "700", marginBottom: 8, fontSize: 16 },
  badgeRow: { marginBottom: 10 },
  badgeName: { color: colors.text, fontWeight: "600" },
  badgeMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
