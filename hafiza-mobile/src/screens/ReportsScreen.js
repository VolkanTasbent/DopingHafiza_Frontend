import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchRaporlar } from "../services/quiz";
import { Card, PrimaryButton, SectionTitle } from "../components/ui";
import { colors } from "../theme";

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "-";
  }
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return "-";
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function ReportsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [raporlar, setRaporlar] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchRaporlar(100);
      data.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
      setRaporlar(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const totals = raporlar.reduce(
    (acc, r) => {
      acc.total += r.totalCount || 0;
      acc.correct += r.correctCount || 0;
      return acc;
    },
    { total: 0, correct: 0 }
  );
  const success = totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0;
  const weekly = (() => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return { key, label: d.toLocaleDateString("tr-TR", { weekday: "short" }), total: 0, correct: 0 };
    });
    raporlar.forEach((r) => {
      const key = r?.finishedAt ? new Date(r.finishedAt).toISOString().slice(0, 10) : null;
      if (!key) return;
      const item = days.find((x) => x.key === key);
      if (!item) return;
      item.total += Number(r.totalCount || 0);
      item.correct += Number(r.correctCount || 0);
    });
    return days.map((d) => ({ ...d, ratio: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0 }));
  })();

  const filteredReports = (() => {
    if (activeFilter === "all") return raporlar;
    if (activeFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return raporlar.filter((r) => {
        if (!r?.finishedAt) return false;
        return new Date(r.finishedAt) >= weekAgo;
      });
    }
    if (activeFilter === "strong") {
      return raporlar.filter((r) => {
        const total = Number(r?.totalCount || 0);
        const correct = Number(r?.correctCount || 0);
        const ratio = total > 0 ? (correct / total) * 100 : 0;
        return ratio >= 70;
      });
    }
    return raporlar;
  })();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Raporlarim" subtitle="Cozdugun tum testlerin performans ozeti" />
      <View style={styles.backWrap}>
        <PrimaryButton title="Geri" onPress={() => navigation.navigate("MainTabs", { screen: "HomeTab" })} style={styles.backBtn} />
      </View>
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.total}</Text>
          <Text style={styles.summaryLabel}>Toplam Soru</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.correct}</Text>
          <Text style={styles.summaryLabel}>Toplam Dogru</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryValue}>%{success}</Text>
          <Text style={styles.summaryLabel}>Basari</Text>
        </Card>
      </View>
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Haftalik Basari Grafigi</Text>
        {weekly.map((d) => (
          <View key={d.key} style={styles.chartRow}>
            <Text style={styles.chartDay}>{d.label}</Text>
            <View style={styles.chartBarBg}>
              <View style={[styles.chartBarFill, { width: `${d.ratio}%` }]} />
            </View>
            <Text style={styles.chartVal}>%{d.ratio}</Text>
          </View>
        ))}
      </Card>
      <View style={styles.filterRow}>
        <Pressable style={[styles.filterChip, activeFilter === "all" && styles.filterChipActive]} onPress={() => setActiveFilter("all")}>
          <Text style={[styles.filterText, activeFilter === "all" && styles.filterTextActive]}>Tum Oturumlar</Text>
        </Pressable>
        <Pressable style={[styles.filterChip, activeFilter === "week" && styles.filterChipActive]} onPress={() => setActiveFilter("week")}>
          <Text style={[styles.filterText, activeFilter === "week" && styles.filterTextActive]}>Son 7 Gun</Text>
        </Pressable>
        <Pressable style={[styles.filterChip, activeFilter === "strong" && styles.filterChipActive]} onPress={() => setActiveFilter("strong")}>
          <Text style={[styles.filterText, activeFilter === "strong" && styles.filterTextActive]}>Basarili (%70+)</Text>
        </Pressable>
      </View>
      <FlatList
        data={filteredReports}
        keyExtractor={(item, idx) => String(item.oturumId ?? idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<Text style={styles.empty}>Bu filtrede rapor bulunmuyor.</Text>}
        renderItem={({ item }) => {
          const dogru = item.correctCount ?? 0;
          const yanlis = item.wrongCount ?? 0;
          const toplam = item.totalCount ?? 0;
          const bos = toplam - dogru - yanlis;
          const net = (dogru - yanlis / 4).toFixed(2);
          const ratio = toplam > 0 ? Math.round((dogru / toplam) * 100) : 0;
          return (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Oturum #{item.oturumId ?? "-"}</Text>
              <View style={styles.metricsRow}>
                <View style={styles.metricPill}>
                  <Text style={styles.metricValue}>{toplam}</Text>
                  <Text style={styles.metricLabel}>Soru</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={[styles.metricValue, { color: colors.success }]}>{dogru}</Text>
                  <Text style={styles.metricLabel}>Dogru</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={[styles.metricValue, { color: colors.danger }]}>{yanlis}</Text>
                  <Text style={styles.metricLabel}>Yanlis</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricValue}>{bos}</Text>
                  <Text style={styles.metricLabel}>Bos</Text>
                </View>
              </View>
              <Text style={styles.net}>Net: {net} | Basari: %{ratio}</Text>
              <Text style={styles.meta}>Tarih: {formatDate(item.finishedAt)}</Text>
              <Text style={styles.meta}>Sure: {formatDuration(item.durationMs)}</Text>
              <View style={{ marginTop: 10 }}>
                <PrimaryButton title="Detayi Gor" onPress={() => navigation.navigate("ReportDetail", { oturumId: item.oturumId })} />
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  backWrap: { marginBottom: 8 },
  backBtn: { alignSelf: "flex-start", minWidth: 86 },
  summaryCard: { flex: 1, alignItems: "center", paddingVertical: 12 },
  summaryValue: { fontSize: 20, fontWeight: "800", color: colors.primary },
  summaryLabel: { color: colors.muted, fontSize: 12, marginTop: 3 },
  chartCard: { marginBottom: 12 },
  chartTitle: { fontWeight: "800", fontSize: 15, color: colors.text, marginBottom: 8 },
  chartRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  chartDay: { width: 38, color: colors.muted, fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
  chartBarBg: { flex: 1, height: 10, backgroundColor: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginHorizontal: 8 },
  chartBarFill: { height: "100%", backgroundColor: colors.primary },
  chartVal: { width: 42, textAlign: "right", color: colors.text, fontWeight: "800", fontSize: 12 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  filterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: colors.primary },
  empty: { color: "#6b7280", marginTop: 20 },
  card: { marginBottom: 10 },
  cardTitle: { fontWeight: "700", marginBottom: 6 },
  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  metricPill: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, alignItems: "center" },
  metricValue: { color: colors.text, fontWeight: "800", fontSize: 14 },
  metricLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  net: { color: colors.text, fontWeight: "700", marginBottom: 2 },
  meta: { color: "#6b7280", marginTop: 3, fontSize: 12 },
});
