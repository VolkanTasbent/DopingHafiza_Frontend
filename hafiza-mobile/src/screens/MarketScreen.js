import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SectionTitle } from "../components/ui";
import { fetchMarketItemsFromApi, purchaseMarketItem, syncGamification } from "../services/gamification";
import { MARKET_ITEMS } from "../services/gamificationData";
import { useTheme } from "../context/ThemeContext";

function createMarketStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 16 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    balanceCard: { marginBottom: 10, alignItems: "center" },
    balanceLabel: { color: c.muted, fontWeight: "600" },
    balanceValue: { color: c.primary, fontSize: 26, fontWeight: "800", marginTop: 4 },
    itemCard: { marginBottom: 10, flexDirection: "row", gap: 12, alignItems: "center" },
    itemTitle: { fontWeight: "700", color: c.text },
    itemDesc: { color: c.muted, fontSize: 12, marginTop: 2 },
    itemPrice: { color: c.text, fontWeight: "700", marginTop: 8 },
    buyBtn: { minWidth: 100 },
  });
}

export default function MarketScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createMarketStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState(MARKET_ITEMS);
  const [gold, setGold] = useState(0);
  const [ownedItems, setOwnedItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [items, sync] = await Promise.all([fetchMarketItemsFromApi(), syncGamification()]);
        if (items?.length) setCatalog(items);
        if (sync?.state) {
          setGold(sync.state.gold || 0);
          setOwnedItems(sync.state.ownedItems || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const repeatable = (id) => id.startsWith("instant_");

  async function buyItem(item) {
    if (!repeatable(item.id) && ownedItems.includes(item.id)) {
      Alert.alert("Bilgi", "Bu urun zaten satin alinmis.");
      return;
    }
    if (gold < item.price) {
      Alert.alert("Yetersiz Bakiye", "Bu urun icin yeterli altinin yok.");
      return;
    }
    const { state, error } = await purchaseMarketItem(item.id);
    if (error) {
      Alert.alert("Hata", error);
      return;
    }
    if (state) {
      setGold(state.gold || 0);
      setOwnedItems(state.ownedItems || []);
    }
    Alert.alert("Basarili", `${item.label} satin alindi.`);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Market" subtitle="Sunucudaki altin bakiyenle urun satin al" />
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Mevcut Bakiye</Text>
        <Text style={styles.balanceValue}>{gold} altin</Text>
      </Card>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {catalog.map((item) => {
          const owned = !repeatable(item.id) && ownedItems.includes(item.id);
          return (
            <Card key={item.id} style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.label}</Text>
                <Text style={styles.itemDesc}>{item.desc}</Text>
                <Text style={styles.itemPrice}>{owned ? "Satin alindi" : `${item.price} altin`}</Text>
              </View>
              <PrimaryButton
                title={owned ? "Var" : "Satin Al"}
                disabled={owned || gold < item.price}
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
