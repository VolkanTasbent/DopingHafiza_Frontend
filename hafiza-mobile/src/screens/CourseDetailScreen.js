import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SectionTitle, SecondaryButton } from "../components/ui";
import { fetchKonular, fetchRaporlar } from "../services/quiz";
import { colors } from "../theme";

function makeVideoItems(konu) {
  const list = Array.isArray(konu?.videolar) ? konu.videolar : [];
  if (list.length > 0) {
    return list
      .map((v, idx) => ({
        id: v.id ? String(v.id) : `${konu.id}_${idx}`,
        title: v.videoAdi || v.video_adi || `Video ${idx + 1}`,
      }))
      .filter((x) => !!x.title);
  }
  const url = konu?.konuAnlatimVideosuUrl || konu?.konu_anlatim_videosu_url || konu?.videoUrl || konu?.video_url;
  if (!url) return [];
  return [{ id: String(konu.id), title: konu?.ad || "Konu Videosu" }];
}

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = String(process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (!base) return raw;
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export default function CourseDetailScreen({ route, navigation }) {
  const ders = route?.params?.ders;
  const initialTab = route?.params?.initialTab;
  const initialKonuId = route?.params?.initialKonuId;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab === "videolar" || initialTab === "istatistik" ? initialTab : "konular");
  const [selectedVideoKonuId, setSelectedVideoKonuId] = useState(initialKonuId || null);
  const [konular, setKonular] = useState([]);
  const [raporlar, setRaporlar] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [k, r] = await Promise.all([fetchKonular(ders?.id), fetchRaporlar(120)]);
        setKonular(Array.isArray(k) ? k : []);
        setRaporlar(Array.isArray(r) ? r : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [ders?.id]);

  useEffect(() => {
    if (initialTab === "videolar" || initialTab === "istatistik" || initialTab === "konular") {
      setActiveTab(initialTab);
    }
    if (initialKonuId) {
      setSelectedVideoKonuId(initialKonuId);
    }
  }, [initialTab, initialKonuId]);

  const dersRaporlari = useMemo(() => {
    const dersId = String(ders?.id || "");
    const dersAd = String(ders?.ad || "").toLowerCase().trim();
    return raporlar.filter((r) => {
      const reportDersId = String(r?.dersId || r?.ders?.id || r?.courseId || "");
      const reportDersAd = String(r?.dersAd || r?.dersAdi || r?.ders?.ad || "").toLowerCase().trim();
      if (dersId && reportDersId && dersId === reportDersId) return true;
      if (dersAd && reportDersAd && dersAd === reportDersAd) return true;
      return false;
    });
  }, [raporlar, ders?.id, ders?.ad]);

  const stats = useMemo(() => {
    const totalVideo = konular.reduce((sum, k) => sum + makeVideoItems(k).length, 0);
    const withDocs = konular.filter((k) => !!(k?.dokumanUrl || k?.dokuman_url)).length;
    const totalSolved = dersRaporlari.reduce((sum, r) => sum + Number(r.totalCount || 0), 0);
    const totalCorrect = dersRaporlari.reduce((sum, r) => sum + Number(r.correctCount || 0), 0);
    const success = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;
    const totalWrong = dersRaporlari.reduce((sum, r) => sum + Number(r.wrongCount || 0), 0);
    const net = Number((totalCorrect - totalWrong / 4).toFixed(2));
    return { totalVideo, withDocs, totalSolved, success, net, totalReports: dersRaporlari.length };
  }, [konular, dersRaporlari]);

  const videoKonular = useMemo(() => konular.filter((k) => makeVideoItems(k).length > 0), [konular]);

  const shownVideoKonular = useMemo(() => {
    if (!selectedVideoKonuId) return videoKonular;
    return videoKonular.filter((k) => String(k.id) === String(selectedVideoKonuId));
  }, [videoKonular, selectedVideoKonuId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title={ders?.ad || "Ders Detay"} subtitle="Webdeki Ders Detay akisinin mobil karsiligi" />
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, activeTab === "konular" && styles.tabBtnActive]} onPress={() => setActiveTab("konular")}>
          <Text style={[styles.tabText, activeTab === "konular" && styles.tabTextActive]}>Konular</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, activeTab === "videolar" && styles.tabBtnActive]} onPress={() => setActiveTab("videolar")}>
          <Text style={[styles.tabText, activeTab === "videolar" && styles.tabTextActive]}>Videolar</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, activeTab === "istatistik" && styles.tabBtnActive]} onPress={() => setActiveTab("istatistik")}>
          <Text style={[styles.tabText, activeTab === "istatistik" && styles.tabTextActive]}>Istatistik</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {activeTab === "konular" &&
          konular.map((k) => (
            <Card key={k.id} style={styles.card}>
              <Text style={styles.title}>{k.ad}</Text>
              <Text style={styles.meta}>{k.aciklama || "Aciklama bulunmuyor."}</Text>
              <View style={styles.row}>
                <PrimaryButton title="Soru Coz" style={{ flex: 1 }} onPress={() => navigation.navigate("Quiz", { ders })} />
                <SecondaryButton
                  title="Videolar"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setActiveTab("videolar");
                    setSelectedVideoKonuId(k.id);
                  }}
                />
              </View>
              {!!(k?.dokumanUrl || k?.dokuman_url) && (
                <View style={{ marginTop: 8 }}>
                  <SecondaryButton
                    title="Konu Dokumanini Ac"
                    onPress={async () => {
                      const u = toAbsoluteUrl(k?.dokumanUrl || k?.dokuman_url);
                      if (!u) return;
                      try {
                        await Linking.openURL(u);
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </View>
              )}
            </Card>
          ))}

        {activeTab === "videolar" && (
          <>
            <Card style={styles.card}>
              <Text style={styles.title}>Konu Filtresi</Text>
              <View style={styles.tabRow}>
                <Pressable style={[styles.chip, !selectedVideoKonuId && styles.chipActive]} onPress={() => setSelectedVideoKonuId(null)}>
                  <Text style={[styles.chipText, !selectedVideoKonuId && styles.chipTextActive]}>Tum Konular</Text>
                </Pressable>
                {videoKonular.map((k) => (
                  <Pressable
                    key={`chip-${k.id}`}
                    style={[styles.chip, selectedVideoKonuId === k.id && styles.chipActive]}
                    onPress={() => setSelectedVideoKonuId(k.id)}
                  >
                    <Text style={[styles.chipText, selectedVideoKonuId === k.id && styles.chipTextActive]}>{k.ad}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
            {shownVideoKonular.map((k) => {
            const videos = makeVideoItems(k);
            if (videos.length === 0) return null;
            return (
              <Card key={`v-${k.id}`} style={styles.card}>
                <Text style={styles.title}>{k.ad}</Text>
                {videos.map((v) => (
                  <View key={v.id} style={styles.videoRow}>
                    <Text style={styles.meta}>{v.title}</Text>
                  </View>
                ))}
                <View style={{ marginTop: 8 }}>
                  <PrimaryButton title="Konu Videolarina Git" onPress={() => navigation.navigate("VideoLessons")} />
                </View>
              </Card>
            );
            })}
          </>
        )}

        {activeTab === "istatistik" && (
          <>
            <Card style={styles.card}>
              <Text style={styles.title}>Ders Ozeti</Text>
              <Text style={styles.meta}>Toplam konu: {konular.length}</Text>
              <Text style={styles.meta}>Toplam video: {stats.totalVideo}</Text>
              <Text style={styles.meta}>Dokumanli konu: {stats.withDocs}</Text>
            </Card>
            <Card style={styles.card}>
              <Text style={styles.title}>Calisma Ozeti</Text>
              <Text style={styles.meta}>Toplam cozulen soru: {stats.totalSolved}</Text>
              <Text style={styles.meta}>Genel basari: %{stats.success}</Text>
              <Text style={styles.meta}>Net: {stats.net}</Text>
              <Text style={styles.meta}>Oturum sayisi: {stats.totalReports}</Text>
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
  tabBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: "#fff" },
  tabBtnActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tabText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: colors.primary },
  card: { marginBottom: 10 },
  title: { color: colors.text, fontWeight: "800", marginBottom: 6 },
  meta: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  videoRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: colors.primary },
});
