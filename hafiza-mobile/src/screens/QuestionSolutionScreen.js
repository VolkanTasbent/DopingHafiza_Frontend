import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Card, SectionTitle } from "../components/ui";
import { colors } from "../theme";

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

function getSolutionVideoUrl(soru) {
  if (!soru) return "";
  return (
    soru?.videoUrl ||
    soru?.video_url ||
    soru?.cozumUrl ||
    soru?.cozum_url ||
    soru?.cozumVideosuUrl ||
    soru?.cozum_videosu_url ||
    ""
  );
}

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = String(process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (!base) return raw;
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export default function QuestionSolutionScreen({ route }) {
  const reportItem = route?.params?.reportItem;
  const questionIndex = route?.params?.questionIndex;

  const analyzed = useMemo(() => analyzeItem(reportItem), [reportItem]);
  const soru = analyzed?.soru;
  const secenekler = Array.isArray(soru?.secenekler) ? soru.secenekler : [];
  const cozumText = soru?.cozum || soru?.aciklama || soru?.explanation || "";
  const solutionVideoUrl = toAbsoluteUrl(getSolutionVideoUrl(soru));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle
        title={`Soru Cozumu ${questionIndex ? `#${questionIndex}` : ""}`}
        subtitle={soru?.dersAd || soru?.ders?.ad || "Rapor sorusu"}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {solutionVideoUrl ? (
          <Card style={styles.card}>
            <Text style={styles.blockTitle}>Cozum Videosu</Text>
            <WebView source={{ uri: solutionVideoUrl }} style={styles.player} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.question}>{soru?.metin || "Soru metni bulunamadi."}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.blockTitle}>Secenekler</Text>
          {secenekler.map((opt, idx) => {
            const isChosen = analyzed?.chosen?.id != null ? analyzed.chosen.id === opt.id : false;
            const isCorrect = analyzed?.correct?.id != null ? analyzed.correct.id === opt.id : false;
            return (
              <View key={String(opt.id || idx)} style={[styles.optionRow, isCorrect && styles.optionCorrect, isChosen && !isCorrect && styles.optionWrong]}>
                <Text style={styles.optionText}>{opt?.metin || "-"}</Text>
                <Text style={styles.badge}>
                  {isCorrect ? "Dogru" : isChosen ? "Senin Cevabin" : ""}
                </Text>
              </View>
            );
          })}
          {secenekler.length === 0 ? <Text style={styles.meta}>Secenek bulunamadi.</Text> : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.blockTitle}>Sonuc</Text>
          <Text style={styles.meta}>Senin cevabin: {analyzed.isBlank ? "Bos" : analyzed.chosen?.metin || "-"}</Text>
          <Text style={styles.meta}>Dogru cevap: {analyzed.correct?.metin || "-"}</Text>
          <Text style={[styles.meta, { color: analyzed.isCorrect ? colors.success : colors.danger, fontWeight: "800" }]}>
            {analyzed.isCorrect ? "Dogru cevapladin." : analyzed.isBlank ? "Bos birakmissin." : "Yanlis cevapladin."}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.blockTitle}>Cozum Aciklamasi</Text>
          <Text style={styles.meta}>{cozumText || "Bu soru icin cozum aciklamasi bulunamadi."}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { marginBottom: 10 },
  question: { color: colors.text, fontSize: 16, fontWeight: "700", lineHeight: 22 },
  blockTitle: { color: colors.text, fontWeight: "800", marginBottom: 8 },
  optionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  optionCorrect: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  optionWrong: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  optionText: { color: colors.text, fontWeight: "600" },
  badge: { color: colors.muted, fontSize: 12, marginTop: 4, fontWeight: "700" },
  meta: { color: colors.muted, marginBottom: 4, lineHeight: 19 },
  player: { width: "100%", height: 220, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
});
