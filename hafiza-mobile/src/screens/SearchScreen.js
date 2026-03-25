import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, SectionTitle } from "../components/ui";
import { fetchDenemeSinavlari, fetchDersler, fetchKonular, fetchRaporlar } from "../services/quiz";
import { getJSON } from "../services/storage";
import { colors } from "../theme";

function normalize(v) {
  return String(v || "")
    .toLocaleLowerCase("tr-TR")
    .trim();
}

function simplify(v) {
  return normalize(v)
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return simplify(text)
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean);
}

function isSubsequence(needle, hay) {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j += 1) {
    if (needle[i] === hay[j]) i += 1;
  }
  return i === needle.length;
}

function scoreItem(item, rawQuery) {
  const q = simplify(rawQuery);
  if (!q) return 0;

  const title = simplify(item.title);
  const subtitle = simplify(item.subtitle);
  const type = simplify(item.type);
  const keywords = simplify(item.keywords || "");
  const hay = `${title} ${subtitle} ${type} ${keywords}`.trim();
  const qTokens = tokenize(q);

  let score = 0;

  if (title === q) score += 120;
  else if (title.startsWith(q)) score += 90;
  else if (title.includes(q)) score += 70;

  if (subtitle.includes(q)) score += 35;
  if (keywords.includes(q)) score += 35;
  if (type.includes(q)) score += 25;

  qTokens.forEach((token) => {
    if (!token) return;
    if (title.startsWith(token)) score += 22;
    else if (title.includes(token)) score += 16;

    if (subtitle.includes(token)) score += 10;
    if (keywords.includes(token)) score += 10;
    if (type.includes(token)) score += 6;
  });

  if (isSubsequence(q.replace(/\s/g, ""), hay.replace(/\s/g, ""))) score += 8;

  return score;
}

export default function SearchScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dataset, setDataset] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [dersler, denemeler, raporlar, tasks] = await Promise.all([
          fetchDersler(),
          fetchDenemeSinavlari(),
          fetchRaporlar(60),
          getJSON("study_tasks", []),
        ]);
        const dersList = Array.isArray(dersler) ? dersler : [];
        const konuPairs = (
          await Promise.all(
            dersList.map(async (d) => {
              try {
                const konular = await fetchKonular(d.id);
                return (Array.isArray(konular) ? konular : []).map((k) => ({ ders: d, konu: k }));
              } catch {
                return [];
              }
            })
          )
        ).flat();
        const items = [
          ...dersList.map((d) => ({
            id: `ders-${d.id}`,
            title: d.ad || "Ders",
            subtitle: d.aciklama || "Ders icerigi",
            type: "ders",
            keywords: "konu test soru coz ders detay",
            payload: d,
          })),
          ...konuPairs.map(({ ders, konu }, i) => ({
            id: `konu-${konu?.id || i}-${ders?.id || "d"}`,
            title: konu?.ad || "Konu",
            subtitle: `${ders?.ad || "Ders"} | ${konu?.aciklama || "Konu anlatimi"}`,
            type: "konu",
            keywords: "konu video ders detay soru coz",
            payload: { ders, konu },
          })),
          ...(Array.isArray(denemeler) ? denemeler : []).map((x, i) => ({
            id: `deneme-${x.id || x.deneme_sinavi_id || i}`,
            title: x.adi || x.deneme_adi || "Deneme",
            subtitle: "Deneme sinavi",
            type: "deneme",
            keywords: "tyt ayt sinav deneme",
            payload: x,
          })),
          ...(Array.isArray(raporlar) ? raporlar : []).map((r, i) => ({
            id: `rapor-${r.oturumId || i}`,
            title: `Rapor #${r.oturumId || i + 1}`,
            subtitle: `Dogru ${r.correctCount || 0} | Toplam ${r.totalCount || 0}`,
            type: "rapor",
            keywords: "sonuc analiz grafik net",
            payload: r,
          })),
          ...(Array.isArray(tasks) ? tasks : []).map((t, i) => ({
            id: `task-${t.id || i}`,
            title: t.title || "Gorev",
            subtitle: `${t.category || "Gorev"} | ${t.priority || "Orta"}`,
            type: "task",
            keywords: "calisma gorev plan",
            payload: t,
          })),
        ];
        setDataset(items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return dataset.slice(0, 30);
    return dataset
      .map((item) => ({ item, score: scoreItem(item, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
      .map((x) => x.item);
  }, [dataset, query]);

  function openItem(item) {
    if (item.type === "ders") {
      navigation.navigate("Quiz", { ders: item.payload });
      return;
    }
    if (item.type === "deneme") {
      navigation.navigate("MainTabs", { screen: "DenemeTab" });
      return;
    }
    if (item.type === "konu") {
      const ders = item?.payload?.ders;
      const konu = item?.payload?.konu;
      if (ders?.id) {
        navigation.navigate("CourseDetail", {
          ders,
          initialTab: "videolar",
          initialKonuId: konu?.id || null,
        });
      } else {
        navigation.navigate("VideoLessons");
      }
      return;
    }
    if (item.type === "rapor") {
      if (item?.payload?.oturumId) {
        navigation.navigate("ReportDetail", { oturumId: item.payload.oturumId });
      } else {
        navigation.navigate("MainTabs", { screen: "ReportsTab" });
      }
      return;
    }
    if (item.type === "task") {
      navigation.navigate("Tasks");
      return;
    }
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
      <Card style={styles.topBar}>
        <Pressable onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MainTabs", { screen: "HomeTab" }))}>
          <Text style={styles.backText}>← Geri</Text>
        </Pressable>
      </Card>
      <SectionTitle title="Arama" subtitle="Ders, deneme, rapor ve gorev ara" />
      <Card style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="Orn: matematik, deneme, rapor..."
          value={query}
          onChangeText={setQuery}
        />
      </Card>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {filtered.map((item) => (
          <Pressable key={item.id} onPress={() => openItem(item)}>
            <Card style={styles.item}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </Card>
          </Pressable>
        ))}
        {filtered.length === 0 ? (
          <Card style={styles.item}>
            <Text style={styles.subtitle}>Sonuc bulunamadi.</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { marginBottom: 8, paddingVertical: 10 },
  backText: { color: colors.primary, fontWeight: "800" },
  searchBox: { marginBottom: 10 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  item: { marginBottom: 8 },
  title: { color: colors.text, fontWeight: "700" },
  subtitle: { color: colors.muted, marginTop: 2, fontSize: 12 },
});
