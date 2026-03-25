import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, ProgressBar, SectionTitle, SecondaryButton } from "../components/ui";
import { fetchRaporlar } from "../services/quiz";
import { colors } from "../theme";

function groupByDay(raporlar) {
  const out = {};
  raporlar.forEach((r) => {
    if (!r.finishedAt) return;
    const key = new Date(r.finishedAt).toLocaleDateString("tr-TR");
    if (!out[key]) out[key] = { total: 0, correct: 0, wrong: 0 };
    out[key].total += r.totalCount || 0;
    out[key].correct += r.correctCount || 0;
    out[key].wrong += r.wrongCount || 0;
  });
  return out;
}

export default function InsightsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [raporlar, setRaporlar] = useState([]);
  const [rangeFilter, setRangeFilter] = useState("30"); // 7 | 30 | 90 | all
  const [courseFilter, setCourseFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchRaporlar(300);
        setRaporlar(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredReports = useMemo(() => {
    let list = raporlar;
    if (courseFilter !== "all") {
      list = list.filter((r) => {
        const name = String(r.dersAd || r.dersAdi || r?.ders?.ad || "Genel");
        return name === courseFilter;
      });
    }
    if (rangeFilter === "all") return list;
    const days = Number(rangeFilter);
    const from = new Date();
    from.setDate(from.getDate() - days);
    return list.filter((r) => {
      if (!r?.finishedAt) return false;
      return new Date(r.finishedAt) >= from;
    });
  }, [raporlar, rangeFilter, courseFilter]);

  const courseOptions = useMemo(() => {
    const names = Array.from(new Set(raporlar.map((r) => String(r.dersAd || r.dersAdi || r?.ders?.ad || "Genel"))));
    return names.sort((a, b) => a.localeCompare(b, "tr"));
  }, [raporlar]);

  const comparison = useMemo(() => {
    if (rangeFilter === "all") {
      return { enabled: false, prevSuccess: 0, currentSuccess: 0, delta: 0, prevCount: 0, currentCount: filteredReports.length };
    }
    const days = Number(rangeFilter);
    const now = new Date();
    const currentFrom = new Date(now);
    currentFrom.setDate(now.getDate() - days);
    const prevFrom = new Date(currentFrom);
    prevFrom.setDate(currentFrom.getDate() - days);
    const base = courseFilter === "all"
      ? raporlar
      : raporlar.filter((r) => String(r.dersAd || r.dersAdi || r?.ders?.ad || "Genel") === courseFilter);
    const current = base.filter((r) => r?.finishedAt && new Date(r.finishedAt) >= currentFrom);
    const prev = base.filter((r) => {
      if (!r?.finishedAt) return false;
      const d = new Date(r.finishedAt);
      return d >= prevFrom && d < currentFrom;
    });
    const score = (arr) => {
      const total = arr.reduce((a, r) => a + Number(r.totalCount || 0), 0);
      const correct = arr.reduce((a, r) => a + Number(r.correctCount || 0), 0);
      return total > 0 ? Math.round((correct / total) * 100) : 0;
    };
    const currentSuccess = score(current);
    const prevSuccess = score(prev);
    return {
      enabled: true,
      currentSuccess,
      prevSuccess,
      delta: currentSuccess - prevSuccess,
      prevCount: prev.length,
      currentCount: current.length,
    };
  }, [raporlar, filteredReports.length, rangeFilter, courseFilter]);

  const stats = useMemo(() => {
    const total = filteredReports.reduce((a, r) => a + (r.totalCount || 0), 0);
    const correct = filteredReports.reduce((a, r) => a + (r.correctCount || 0), 0);
    const wrong = filteredReports.reduce((a, r) => a + (r.wrongCount || 0), 0);
    const empty = Math.max(0, total - correct - wrong);
    const success = total > 0 ? Math.round((correct / total) * 100) : 0;

    const byDay = groupByDay(filteredReports);
    const recent = Object.entries(byDay)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => {
        const [ad, am, ay] = a.date.split(".").map(Number);
        const [bd, bm, byear] = b.date.split(".").map(Number);
        return new Date(byear, bm - 1, bd) - new Date(ay, am - 1, ad);
      })
      .slice(0, 7);

    const donut = [
      { label: "Dogru", value: correct, color: "#16a34a" },
      { label: "Yanlis", value: wrong, color: "#dc2626" },
      { label: "Bos", value: empty, color: "#9ca3af" },
    ];

    const sessions = [...filteredReports]
      .sort((a, b) => new Date(a.finishedAt || 0) - new Date(b.finishedAt || 0))
      .slice(-10)
      .map((r, i) => {
        const t = Number(r.totalCount || 0);
        const c = Number(r.correctCount || 0);
        const w = Number(r.wrongCount || 0);
        const ratio = t > 0 ? Math.round((c / t) * 100) : 0;
        const net = Number((c - w / 4).toFixed(2));
        const labelDate = r.finishedAt ? new Date(r.finishedAt).toLocaleDateString("tr-TR") : `Oturum ${i + 1}`;
        return { label: labelDate, ratio, net, total: t };
      });

    const dersMap = {};
    filteredReports.forEach((r) => {
      const name = r.dersAd || r.dersAdi || r?.ders?.ad || "Genel";
      if (!dersMap[name]) dersMap[name] = { total: 0, correct: 0 };
      dersMap[name].total += Number(r.totalCount || 0);
      dersMap[name].correct += Number(r.correctCount || 0);
    });
    const dersStats = Object.entries(dersMap)
      .map(([name, v]) => ({
        name,
        total: v.total,
        success: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const maxDaily = Math.max(1, ...recent.map((r) => r.total || 0));
    return { total, correct, wrong, empty, success, recent, donut, maxDaily, sessions, dersStats };
  }, [filteredReports]);

  function goBackSafe() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("MainTabs", { screen: "HomeTab" });
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
        <SecondaryButton title="Geri" onPress={goBackSafe} style={styles.backBtn} />
        <View style={{ flex: 1 }}>
          <SectionTitle title="Grafiklerim" subtitle="Webdeki grafik sayfasinin mobil ozeti" />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <Card style={styles.card}>
          <Text style={styles.h2}>Zaman Filtresi</Text>
          <View style={styles.filterRow}>
            <Pressable style={[styles.filterChip, rangeFilter === "7" && styles.filterChipActive]} onPress={() => setRangeFilter("7")}>
              <Text style={[styles.filterText, rangeFilter === "7" && styles.filterTextActive]}>Son 7 Gun</Text>
            </Pressable>
            <Pressable style={[styles.filterChip, rangeFilter === "30" && styles.filterChipActive]} onPress={() => setRangeFilter("30")}>
              <Text style={[styles.filterText, rangeFilter === "30" && styles.filterTextActive]}>Son 30 Gun</Text>
            </Pressable>
            <Pressable style={[styles.filterChip, rangeFilter === "90" && styles.filterChipActive]} onPress={() => setRangeFilter("90")}>
              <Text style={[styles.filterText, rangeFilter === "90" && styles.filterTextActive]}>Son 90 Gun</Text>
            </Pressable>
            <Pressable style={[styles.filterChip, rangeFilter === "all" && styles.filterChipActive]} onPress={() => setRangeFilter("all")}>
              <Text style={[styles.filterText, rangeFilter === "all" && styles.filterTextActive]}>Tum Zaman</Text>
            </Pressable>
          </View>
          <Text style={styles.meta}>Filtreye giren oturum: {filteredReports.length}</Text>
          <Text style={[styles.meta, { marginTop: 6 }]}>Ders Filtresi</Text>
          <View style={styles.filterRow}>
            <Pressable style={[styles.filterChip, courseFilter === "all" && styles.filterChipActive]} onPress={() => setCourseFilter("all")}>
              <Text style={[styles.filterText, courseFilter === "all" && styles.filterTextActive]}>Tum Dersler</Text>
            </Pressable>
            {courseOptions.map((name) => (
              <Pressable key={name} style={[styles.filterChip, courseFilter === name && styles.filterChipActive]} onPress={() => setCourseFilter(name)}>
                <Text style={[styles.filterText, courseFilter === name && styles.filterTextActive]}>{name}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
        <Card style={styles.card}>
          <Text style={styles.h2}>Donem Karsilastirma</Text>
          {comparison.enabled ? (
            <>
              <Text style={styles.meta}>Bu donem basari: %{comparison.currentSuccess} ({comparison.currentCount} oturum)</Text>
              <Text style={styles.meta}>Onceki donem basari: %{comparison.prevSuccess} ({comparison.prevCount} oturum)</Text>
              <Text style={[styles.meta, { color: comparison.delta >= 0 ? colors.success : colors.danger, fontWeight: "800" }]}>
                Degisim: {comparison.delta >= 0 ? "+" : ""}
                {comparison.delta} puan
              </Text>
            </>
          ) : (
            <Text style={styles.meta}>Tum zaman seciminde donem karsilastirmasi gosterilmez.</Text>
          )}
        </Card>
        <Card style={styles.card}>
          <Text style={styles.h2}>Genel Basari</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{stats.total}</Text>
              <Text style={styles.kpiLabel}>Toplam</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: "#16a34a" }]}>{stats.correct}</Text>
              <Text style={styles.kpiLabel}>Dogru</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: "#dc2626" }]}>{stats.wrong}</Text>
              <Text style={styles.kpiLabel}>Yanlis</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>%{stats.success}</Text>
              <Text style={styles.kpiLabel}>Basari</Text>
            </View>
          </View>
          <ProgressBar value={stats.success} height={10} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Dogru-Yanlis-Bos Dagilimi</Text>
          {stats.total === 0 ? (
            <Text style={styles.meta}>Grafik icin yeterli veri yok.</Text>
          ) : (
            stats.donut.map((item) => {
              const ratio = Math.round((item.value / Math.max(1, stats.total)) * 100);
              return (
                <View key={item.label} style={styles.barRow}>
                  <Text style={styles.barLabel}>{item.label}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${ratio}%`, backgroundColor: item.color }]} />
                  </View>
                  <Text style={styles.barVal}>
                    {item.value} (%{ratio})
                  </Text>
                </View>
              );
            })
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Son 7 Gun Basari Grafigi</Text>
          {stats.recent.length === 0 ? (
            <Text style={styles.meta}>Veri bulunamadi.</Text>
          ) : (
            <View style={styles.weekChart}>
              {stats.recent.map((d) => {
                const rate = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
                const h = Math.max(8, Math.round((d.total / stats.maxDaily) * 110));
                return (
                  <View key={d.date} style={styles.weekCol}>
                    <View style={[styles.weekBar, { height: h }]}>
                      <View style={[styles.weekBarFill, { height: `${rate}%` }]} />
                    </View>
                    <Text style={styles.weekRate}>%{rate}</Text>
                    <Text style={styles.weekDay}>{d.date.slice(0, 5)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Son 10 Oturum Basari</Text>
          {stats.sessions.length === 0 ? (
            <Text style={styles.meta}>Oturum verisi bulunamadi.</Text>
          ) : (
            stats.sessions.map((s, idx) => (
              <View key={`${s.label}-${idx}`} style={styles.barRow}>
                <Text style={styles.oturumLabel}>{s.label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${s.ratio}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={styles.barVal}>%{s.ratio}</Text>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Net Gelisimi</Text>
          {stats.sessions.length === 0 ? (
            <Text style={styles.meta}>Net verisi bulunamadi.</Text>
          ) : (
            stats.sessions.map((s, idx) => (
              <View key={`net-${idx}`} style={styles.netRow}>
                <Text style={styles.oturumLabel}>{s.label}</Text>
                <View style={styles.netTrack}>
                  <View
                    style={[
                      styles.netFill,
                      {
                        width: `${Math.min(100, Math.round((Math.abs(s.net) / 40) * 100))}%`,
                        backgroundColor: s.net >= 0 ? "#16a34a" : "#dc2626",
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.netVal, { color: s.net >= 0 ? "#16a34a" : "#dc2626" }]}>
                  {s.net >= 0 ? "+" : ""}
                  {s.net}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Ders Bazli Basari</Text>
          {stats.dersStats.length === 0 ? (
            <Text style={styles.meta}>Ders bazli veri bulunamadi.</Text>
          ) : (
            stats.dersStats.map((d) => (
              <View key={d.name} style={styles.barRow}>
                <Text style={styles.oturumLabel}>{d.name}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${d.success}%`, backgroundColor: "#0ea5e9" }]} />
                </View>
                <Text style={styles.barVal}>%{d.success}</Text>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Aksiyonlar</Text>
          <View style={styles.actions}>
            <PrimaryButton title="Calisma Gorevleri" style={{ flex: 1 }} onPress={() => navigation.navigate("Tasks")} />
            <PrimaryButton title="Raporlara Git" style={{ flex: 1 }} onPress={() => navigation.navigate("MainTabs", { screen: "ReportsTab" })} />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  topRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  backBtn: { minWidth: 76, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { marginBottom: 10 },
  h2: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: colors.text },
  meta: { color: colors.muted, fontSize: 12 },
  kpiRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  kpiItem: { alignItems: "center", flex: 1 },
  kpiValue: { color: colors.primary, fontWeight: "800", fontSize: 18 },
  kpiLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  barLabel: { width: 46, color: colors.text, fontWeight: "700", fontSize: 12 },
  barTrack: { flex: 1, height: 10, backgroundColor: "#e5e7eb", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%" },
  barVal: { width: 84, textAlign: "right", color: colors.muted, fontSize: 11, fontWeight: "700" },
  oturumLabel: { width: 70, color: colors.text, fontWeight: "700", fontSize: 11 },
  weekChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 8 },
  weekCol: { width: "13.5%", alignItems: "center" },
  weekBar: {
    width: "100%",
    maxWidth: 26,
    borderRadius: 8,
    backgroundColor: "#dbe2ff",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  weekBarFill: { width: "100%", backgroundColor: colors.primary, minHeight: 5 },
  weekRate: { color: colors.primary, fontSize: 11, fontWeight: "800", marginTop: 4 },
  weekDay: { color: colors.muted, fontSize: 10, marginTop: 2 },
  netRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  netTrack: { flex: 1, height: 10, backgroundColor: "#e5e7eb", borderRadius: 999, overflow: "hidden" },
  netFill: { height: "100%" },
  netVal: { width: 56, textAlign: "right", fontSize: 11, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8 },
  filterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 6 },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: colors.primary },
});
