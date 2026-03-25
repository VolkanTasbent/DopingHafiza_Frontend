import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SectionTitle } from "../components/ui";
import { fetchRaporlar } from "../services/quiz";
import { getJSON, setJSON } from "../services/storage";
import { MARKET_ITEMS, calculateStreakFromReports, computeGamificationStats } from "../services/gamificationData";
import { colors } from "../theme";

export default function MarketScreen() {
  const [loading, setLoading] = useState(true);
  const [raporlar, setRaporlar] = useState([]);
  const [ownedItems, setOwnedItems] = useState([]);
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
        setFocusBonus({ xp: Number(focusReward?.xp || 0), gold: Number(focusReward?.gold || 0) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const streak = useMemo(() => calculateStreakFromReports(raporlar), [raporlar]);
  const stats = useMemo(() => computeGamificationStats(raporlar, streak, focusBonus), [raporlar, streak, focusBonus]);
  const availableGold = useMemo(() => {
    const spent = ownedItems.reduce((sum, ownedId) => {
      const item = MARKET_ITEMS.find((i) => i.id === ownedId);
      return sum + (item?.price || 0);
    }, 0);
    return Math.max(0, stats.gold - spent);
  }, [ownedItems, stats.gold]);

  async function buyItem(item) {
    if (ownedItems.includes(item.id)) {
      Alert.alert("Bilgi", "Bu urun zaten satin alinmis.");
      return;
    }
    if (availableGold < item.price) {
      Alert.alert("Yetersiz Bakiye", "Bu urun icin yeterli altinin yok.");
      return;
    }
    const updated = [...ownedItems, item.id];
    setOwnedItems(updated);
    await setJSON("market_owned", updated);
    Alert.alert("Basarili", `${item.label} satin alindi.`);
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
      <SectionTitle title="Market" subtitle="Puanlarinla urun satin al ve hesabini guclendir" />
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Mevcut Bakiye</Text>
        <Text style={styles.balanceValue}>{availableGold} altin</Text>
      </Card>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {MARKET_ITEMS.map((item) => {
          const owned = ownedItems.includes(item.id);
          return (
            <Card key={item.id} style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.label}</Text>
                <Text style={styles.itemDesc}>{item.desc}</Text>
                <Text style={styles.itemPrice}>{owned ? "Satin alindi" : `${item.price} altin`}</Text>
              </View>
              <PrimaryButton
                title={owned ? "Var" : "Satin Al"}
                disabled={owned || availableGold < item.price}
                onPress={() => buyItem(item)}
                style={styles.buyBtn}
              />
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  balanceCard: { marginBottom: 10, alignItems: "center" },
  balanceLabel: { color: colors.muted, fontWeight: "600" },
  balanceValue: { color: colors.primary, fontSize: 26, fontWeight: "800", marginTop: 4 },
  itemCard: { marginBottom: 10, flexDirection: "row", gap: 12, alignItems: "center" },
  itemTitle: { fontWeight: "700", color: colors.text },
  itemDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  itemPrice: { color: colors.text, fontWeight: "700", marginTop: 8 },
  buyBtn: { minWidth: 100 },
});
