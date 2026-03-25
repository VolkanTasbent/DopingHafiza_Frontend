import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SectionTitle } from "../components/ui";
import { colors } from "../theme";
import { fetchRaporDetay } from "../services/quiz";

function analyzeItem(item) {
  const s = item?.soru;
  if (!s || !Array.isArray(s.secenekler)) {
    return { soru: s, chosen: null, correct: null, isBlank: true, isCorrect: false };
  }
  const secenekId = item?.secenekId;
  let chosen = s.secenekler.find((x) => x.id === secenekId);
  if (!chosen && secenekId !== null && secenekId !== undefined && !Number.isNaN(Number(secenekId))) {
    const idx = Number(secenekId) - 1;
    if (idx >= 0 && idx < s.secenekler.length) chosen = s.secenekler[idx];
  }
  const correct = s.secenekler.find((x) => x.dogru === true || x.dogru === 1) || null;
  const isBlank = chosen == null;
  const isCorrect = !isBlank && chosen && correct ? (chosen.id != null && correct.id != null ? chosen.id === correct.id : false) : false;
  return { soru: s, chosen, correct, isBlank, isCorrect };
}

export default function ReportDetailScreen({ route, navigation }) {
  const oturumId = route?.params?.oturumId;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("detay");
  const [detailFilter, setDetailFilter] = useState("wrong");
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchRaporDetay(oturumId);
        setItems(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [oturumId]);

  const wrongCount = useMemo(
    () =>
      items.filter((it) => {
        const a = analyzeItem(it);
        return !a.isBlank && !a.isCorrect;
      }).length,
    [items]
  );

  const list = useMemo(() => {
    if (detailFilter === "all") return items;
    if (detailFilter === "blank") {
      return items.filter((it) => analyzeItem(it).isBlank);
    }
    return items.filter((it) => {
      const a = analyzeItem(it);
      return !a.isBlank && !a.isCorrect;
    });
  }, [items, detailFilter]);

  const chart = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    const dersMap = {};
    const konuMap = {};
    items.forEach((it) => {
      const a = analyzeItem(it);
      if (a.isBlank) blank += 1;
      else if (a.isCorrect) correct += 1;
      else wrong += 1;

      const dersName = a?.soru?.dersAd || a?.soru?.ders?.ad || "Genel";
      if (!dersMap[dersName]) dersMap[dersName] = { total: 0, correct: 0, wrong: 0, blank: 0 };
      dersMap[dersName].total += 1;
      if (a.isBlank) dersMap[dersName].blank += 1;
      else if (a.isCorrect) dersMap[dersName].correct += 1;
      else dersMap[dersName].wrong += 1;

      const konular = Array.isArray(a?.soru?.konular) ? a.soru.konular : [];
      konular.forEach((k) => {
        const key = k?.ad || "Konu";
        if (!konuMap[key]) konuMap[key] = 0;
        if (!a.isBlank && !a.isCorrect) konuMap[key] += 1;
      });
    });

    const totalCount = items.length;
    const total = Math.max(1, totalCount);
    const parts = [
      { id: "c", label: "Dogru", val: correct, color: colors.success, pct: Math.round((correct / total) * 100) },
      { id: "w", label: "Yanlis", val: wrong, color: colors.danger, pct: Math.round((wrong / total) * 100) },
      { id: "b", label: "Bos", val: blank, color: "#9ca3af", pct: Math.round((blank / total) * 100) },
    ];
    const ders = Object.entries(dersMap)
      .map(([name, v]) => ({
        name,
        success: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
        total: v.total,
      }))
      .sort((a, b) => b.total - a.total);
    const topWrongKonular = Object.entries(konuMap)
      .map(([name, val]) => ({ name, val }))
      .filter((x) => x.val > 0)
      .sort((a, b) => b.val - a.val)
      .slice(0, 8);
    const net = Number((correct - wrong / 4).toFixed(2));
    const success = Math.round((correct / total) * 100);
    return { parts, ders, topWrongKonular, totalCount, correct, wrong, blank, success, net };
  }, [items]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title={`Rapor Detay #${oturumId || "-"}`} subtitle="Webdeki detay akisinin mobile karsiligi" />
      <View style={styles.tabRow}>
        <PrimaryButton title="Detaylar" style={{ flex: 1, opacity: activeTab === "detay" ? 1 : 0.7 }} onPress={() => setActiveTab("detay")} />
        <PrimaryButton title="Grafikler" style={{ flex: 1, opacity: activeTab === "grafik" ? 1 : 0.7 }} onPress={() => setActiveTab("grafik")} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {activeTab === "detay" ? (
          <>
            <Card style={styles.card}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryVal}>{chart.totalCount}</Text>
                  <Text style={styles.summaryLabel}>Soru</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={[styles.summaryVal, { color: colors.success }]}>{chart.correct}</Text>
                  <Text style={styles.summaryLabel}>Dogru</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={[styles.summaryVal, { color: colors.danger }]}>{chart.wrong}</Text>
                  <Text style={styles.summaryLabel}>Yanlis</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryVal}>{chart.blank}</Text>
                  <Text style={styles.summaryLabel}>Bos</Text>
                </View>
              </View>
              <Text style={styles.meta}>Basari: %{chart.success} | Net: {chart.net}</Text>
            </Card>
            <View style={styles.row}>
              <PrimaryButton title={`Tum Sorular (${items.length})`} style={{ flex: 1, opacity: detailFilter === "all" ? 1 : 0.7 }} onPress={() => setDetailFilter("all")} />
              <PrimaryButton title={`Yanlislar (${wrongCount})`} style={{ flex: 1, opacity: detailFilter === "wrong" ? 1 : 0.7 }} onPress={() => setDetailFilter("wrong")} />
            </View>
            <View style={styles.row}>
              <PrimaryButton
                title={`Boslar (${chart.blank})`}
                style={{ flex: 1, opacity: detailFilter === "blank" ? 1 : 0.7 }}
                onPress={() => setDetailFilter("blank")}
              />
            </View>
            {list.map((it, idx) => {
              const a = analyzeItem(it);
              return (
                <Card key={`${idx}-${it?.soru?.id || "x"}`} style={styles.card}>
                  <Text style={styles.soruNo}>Soru {idx + 1}</Text>
                  <Text style={styles.meta}>{a?.soru?.dersAd || a?.soru?.ders?.ad || "-"}</Text>
                  <Text style={styles.question}>{a?.soru?.metin || "-"}</Text>
                  <Text style={styles.answerLabel}>Senin cevabin:</Text>
                  <Text style={[styles.answerValue, !a.isBlank && !a.isCorrect ? { color: colors.danger } : null]}>
                    {a.isBlank ? "Bos" : a.chosen?.metin || "-"}
                  </Text>
                  {!a.isCorrect ? (
                    <>
                      <Text style={styles.answerLabel}>Dogru cevap:</Text>
                      <Text style={[styles.answerValue, { color: colors.success }]}>{a.correct?.metin || "-"}</Text>
                    </>
                  ) : null}
                  <View style={{ marginTop: 8 }}>
                    <PrimaryButton
                      title="Soru Cozumune Git"
                      onPress={() =>
                        navigation.navigate("QuestionSolution", {
                          reportItem: it,
                          questionIndex: idx + 1,
                        })
                      }
                    />
                  </View>
                </Card>
              );
            })}
            {list.length === 0 ? (
              <Card>
                <Text style={styles.meta}>Gosterilecek soru bulunamadi.</Text>
              </Card>
            ) : null}
          </>
        ) : (
          <>
            <Card style={styles.card}>
              <Text style={styles.question}>Dogru / Yanlis / Bos</Text>
              {chart.parts.map((p) => (
                <View key={p.id} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{p.label}</Text>
                  <View style={styles.chartTrack}>
                    <View style={[styles.chartFill, { width: `${p.pct}%`, backgroundColor: p.color }]} />
                  </View>
                  <Text style={styles.chartVal}>
                    {p.val} (%{p.pct})
                  </Text>
                </View>
              ))}
            </Card>
            <Card style={styles.card}>
              <Text style={styles.question}>Ders Bazli Basari</Text>
              {chart.ders.length === 0 ? (
                <Text style={styles.meta}>Ders verisi bulunamadi.</Text>
              ) : (
                chart.ders.map((d) => (
                  <View key={d.name} style={styles.chartRow}>
                    <Text style={styles.chartLabel}>{d.name}</Text>
                    <View style={styles.chartTrack}>
                      <View style={[styles.chartFill, { width: `${d.success}%`, backgroundColor: "#3b82f6" }]} />
                    </View>
                    <Text style={styles.chartVal}>%{d.success}</Text>
                  </View>
                ))
              )}
            </Card>
            <Card style={styles.card}>
              <Text style={styles.question}>En Cok Yanlis Yapilan Konular</Text>
              {chart.topWrongKonular.length === 0 ? (
                <Text style={styles.meta}>Konu bazli yanlis verisi yok.</Text>
              ) : (
                chart.topWrongKonular.map((k) => (
                  <View key={k.name} style={styles.chartRow}>
                    <Text style={styles.chartLabel}>{k.name}</Text>
                    <View style={styles.chartTrack}>
                      <View style={[styles.chartFill, { width: `${Math.min(100, k.val * 10)}%`, backgroundColor: colors.danger }]} />
                    </View>
                    <Text style={styles.chartVal}>{k.val}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  row: { flexDirection: "row", gap: 8, marginBottom: 10 },
  card: { marginBottom: 10 },
  soruNo: { color: colors.primary, fontWeight: "800", marginBottom: 4 },
  meta: { color: colors.muted, marginBottom: 6 },
  question: { color: colors.text, fontWeight: "700", marginBottom: 8 },
  answerLabel: { color: colors.muted, fontSize: 12, marginTop: 3 },
  answerValue: { color: colors.text, fontWeight: "700" },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  summaryPill: { flex: 1, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  summaryVal: { color: colors.text, fontSize: 14, fontWeight: "800" },
  summaryLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  chartRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  chartLabel: { width: 90, color: colors.text, fontWeight: "700", fontSize: 12 },
  chartTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden" },
  chartFill: { height: "100%" },
  chartVal: { width: 64, textAlign: "right", color: colors.muted, fontWeight: "700", fontSize: 11 },
});
