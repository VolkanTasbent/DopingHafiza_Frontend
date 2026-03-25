import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchRaporlar } from "../services/quiz";
import { Card, PrimaryButton, SectionTitle } from "../components/ui";
import { colors } from "../theme";
import { getJSON, setJSON } from "../services/storage";
import { BADGE_CATEGORIES, MARKET_ITEMS, calculateStreakFromReports, computeGamificationStats } from "../services/gamificationData";

export default function GamificationScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [raporlar, setRaporlar] = useState([]);
  const [marketOpen, setMarketOpen] = useState(false);
  const [ownedItems, setOwnedItems] = useState([]);
  const [message, setMessage] = useState("");
  const [streak, setStreak] = useState(0);
  const [lastMilestone, setLastMilestone] = useState(null);
  const [focusBonus, setFocusBonus] = useState({ xp: 0, gold: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [data, owned, focusReward] = await Promise.all([
          fetchRaporlar(200),
          getJSON("market_owned", []),
          getJSON("focus_rewards", { xp: 0, gold: 0 }),
        ]);
        setRaporlar(Array.isArray(data) ? data : []);
        setOwnedItems(Array.isArray(owned) ? owned : []);
        setFocusBonus({
          xp: Number(focusReward?.xp || 0),
          gold: Number(focusReward?.gold || 0),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setStreak(calculateStreakFromReports(raporlar));
  }, [raporlar]);

  const stats = useMemo(() => {
    const base = computeGamificationStats(raporlar, streak, focusBonus);
    return { ...base, lastActive: raporlar[0]?.finishedAt || null };
  }, [raporlar, streak, focusBonus]);

  useEffect(() => {
    if (stats.milestones.length > 0) {
      setLastMilestone(stats.milestones[stats.milestones.length - 1]);
    }
  }, [stats.milestones]);

  const categoryProgress = useMemo(() => {
    const values = {
      xp: stats.xp || 0,
      daily: stats.dailySolved || 0,
      accuracy: stats.totalCorrect || 0,
      streak: streak || 0,
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

  const availableGold = useMemo(() => {
    const spent = ownedItems.reduce((sum, ownedId) => {
      const item = MARKET_ITEMS.find((i) => i.id === ownedId);
      return sum + (item?.price || 0);
    }, 0);
    return Math.max(0, stats.gold - spent);
  }, [ownedItems, stats.gold]);

  async function buyItem(item) {
    if (ownedItems.includes(item.id)) {
      setMessage("Bu urun zaten satin alinmis.");
      return;
    }
    if (availableGold < item.price) {
      setMessage("Yeterli altin yok.");
      return;
    }
    const updated = [...ownedItems, item.id];
    setOwnedItems(updated);
    await setJSON("market_owned", updated);
    setMessage(`${item.label} satin alindi.`);
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
      <View style={styles.topRow}>
        <PrimaryButton title="Geri" style={styles.backBtn} onPress={() => navigation.navigate("MainTabs", { screen: "HomeTab" })} />
        <View style={{ flex: 1 }}>
          <SectionTitle title="Gamification" subtitle="Seviye, XP, market ve rozet ilerlemen" />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <Card style={styles.card}>
          <Text style={styles.h2}>Seviye {stats.level}</Text>
          <Text>XP: {stats.currentXP}/{stats.nextLevelXP}</Text>
          <Text>Toplam XP: {stats.xp}</Text>
          <Text>Altin: {availableGold}</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, stats.progress))}%` }]} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Ilerleme Grafigi</Text>
          <View style={styles.chartLegendRow}>
            <Text style={styles.chartLegend}>XP Ilerlemesi</Text>
            <Text style={styles.chartLegendValue}>%{Math.max(0, Math.min(100, Math.round(stats.progress || 0)))}</Text>
          </View>
          <View style={styles.chartTrack}>
            <View style={[styles.chartFillPrimary, { width: `${Math.max(0, Math.min(100, Math.round(stats.progress || 0)))}%` }]} />
          </View>
          <View style={[styles.chartLegendRow, { marginTop: 10 }]}>
            <Text style={styles.chartLegend}>Gunluk Hedef Tamamlama</Text>
            <Text style={styles.chartLegendValue}>%{Math.max(0, Math.min(100, Math.round((stats.dailySolved / 40) * 100)))}</Text>
          </View>
          <View style={styles.chartTrack}>
            <View style={[styles.chartFillSecondary, { width: `${Math.max(0, Math.min(100, Math.round((stats.dailySolved / 40) * 100)))}%` }]} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Gunluk Durum</Text>
          <Text>Bugun cozulen: {stats.dailySolved}</Text>
          <Text>Bugun dogru: {stats.dailyCorrect}</Text>
          <Text>Aktif seri: {streak} gun</Text>
          {stats.dailyNotices.map((n) => (
            <Text key={n} style={styles.notice}>{n}</Text>
          ))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Genel Istatistikler</Text>
          <Text>Toplam cozulen: {stats.totalSolved}</Text>
          <Text>Toplam dogru: {stats.totalCorrect}</Text>
          <Text>Odak bonusu: +{focusBonus.xp} XP, +{focusBonus.gold} altin</Text>
          <Text>Son aktivite: {stats.lastActive ? new Date(stats.lastActive).toLocaleString("tr-TR") : "-"}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Hizli Gecis</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <PrimaryButton title="Rozetler" style={{ flex: 1 }} onPress={() => navigation.navigate("Badges")} />
            <PrimaryButton title="Grafiklerim" style={{ flex: 1 }} onPress={() => navigation.navigate("Insights")} />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PrimaryButton title="Gorevler" style={{ flex: 1 }} onPress={() => navigation.navigate("Tasks")} />
            <PrimaryButton title="Takvim" style={{ flex: 1 }} onPress={() => navigation.navigate("Calendar")} />
          </View>
        </Card>

        {Object.entries(BADGE_CATEGORIES).map(([key, cat]) => (
          <Card key={key} style={styles.card}>
            <Text style={styles.h2}>{cat.name}</Text>
            {categoryProgress[key].map((badge) => (
              <View key={badge.id} style={styles.badgeRow}>
                <Text style={styles.badgeName}>
                  {badge.label} {badge.earned ? "(Kazanildi)" : ""}
                </Text>
                <View style={styles.smallBarBg}>
                  <View style={[styles.smallBarFill, { width: `${badge.percent}%` }]} />
                </View>
                <Text style={styles.badgeMeta}>{badge.earned ? "Tamam" : `${badge.current}/${badge.target}`}</Text>
              </View>
            ))}
          </Card>
        ))}

        <Card style={styles.card}>
          <View style={styles.marketHeader}>
            <Text style={styles.h2}>Market</Text>
            <Pressable style={styles.toggleBtn} onPress={() => setMarketOpen((v) => !v)}>
              <Text style={styles.toggleText}>{marketOpen ? "Kapat" : "Ac"}</Text>
            </Pressable>
          </View>
          <Text style={styles.marketBalance}>Bakiyen: {availableGold} altin</Text>
          {marketOpen &&
            MARKET_ITEMS.map((item) => {
              const owned = ownedItems.includes(item.id);
              return (
                <View key={item.id} style={styles.marketItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.marketTitle}>{item.label}</Text>
                    <Text style={styles.marketDesc}>{item.desc}</Text>
                    <Text style={styles.marketPrice}>{owned ? "Satin alindi" : `${item.price} altin`}</Text>
                  </View>
                  <Pressable
                    disabled={owned || availableGold < item.price}
                    onPress={() => buyItem(item)}
                    style={[styles.buyBtn, (owned || availableGold < item.price) && styles.buyBtnDisabled]}
                  >
                    <Text style={styles.buyText}>{owned ? "Var" : "Al"}</Text>
                  </Pressable>
                </View>
              );
            })}
        </Card>

        {lastMilestone ? (
          <Card style={styles.card}>
            <Text style={styles.h2}>Son Basari</Text>
            <Text>{lastMilestone.name}</Text>
            <Text style={styles.badgeMeta}>
              Odul: +{lastMilestone.reward.xp} XP, +{lastMilestone.reward.gold} altin
            </Text>
          </Card>
        ) : null}

        {!!message && (
          <Card style={styles.card}>
            <Text style={styles.notice}>{message}</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  topRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  backBtn: { minWidth: 78, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { marginBottom: 10 },
  h2: { fontWeight: "700", marginBottom: 6, fontSize: 16 },
  barBg: { width: "100%", height: 12, backgroundColor: "#e5e7eb", borderRadius: 8, marginTop: 8, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#4f46e5" },
  smallBarBg: { width: "100%", height: 8, backgroundColor: "#edf2f7", borderRadius: 999, overflow: "hidden", marginTop: 5 },
  smallBarFill: { height: "100%", backgroundColor: colors.primary },
  badgeRow: { marginBottom: 10 },
  badgeName: { color: colors.text, fontWeight: "600" },
  badgeMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  notice: { color: colors.success, fontWeight: "700", marginTop: 6 },
  chartLegendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  chartLegend: { color: colors.text, fontWeight: "700", fontSize: 12 },
  chartLegendValue: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  chartTrack: { height: 10, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden" },
  chartFillPrimary: { height: "100%", backgroundColor: colors.primary },
  chartFillSecondary: { height: "100%", backgroundColor: "#06b6d4" },
  marketHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  toggleBtn: { backgroundColor: colors.primarySoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  toggleText: { color: colors.primary, fontWeight: "700" },
  marketBalance: { color: colors.muted, marginBottom: 8 },
  marketItem: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  marketTitle: { fontWeight: "700", color: colors.text },
  marketDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  marketPrice: { color: colors.text, marginTop: 4, fontWeight: "600" },
  buyBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  buyBtnDisabled: { backgroundColor: "#9ca3af" },
  buyText: { color: "#fff", fontWeight: "700" },
});
