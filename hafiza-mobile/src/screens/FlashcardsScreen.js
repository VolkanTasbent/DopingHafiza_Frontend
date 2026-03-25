import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { fetchDersler, fetchSorular } from "../services/quiz";
import { colors } from "../theme";

export default function FlashcardsScreen() {
  const [loading, setLoading] = useState(true);
  const [dersler, setDersler] = useState([]);
  const [selectedDersId, setSelectedDersId] = useState(null);
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selections, setSelections] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchDersler();
        setDersler(Array.isArray(data) ? data : []);
        if (data?.[0]?.id) setSelectedDersId(data[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDersId) return;
    (async () => {
      const q = await fetchSorular({ dersId: selectedDersId });
      setCards((Array.isArray(q) ? q : []).slice(0, 60));
      setIndex(0);
      setShowAnswer(false);
      setSelections({});
    })();
  }, [selectedDersId]);

  const current = cards[index];
  const answerText = useMemo(() => {
    if (!current) return "";
    const opts = Array.isArray(current.secenekler) ? current.secenekler : [];
    const correct = opts.find((o) => o?.dogru === true || o?.dogru === 1);
    return correct?.metin || "Dogru cevap bulunamadi.";
  }, [current]);

  const selectedOptionId = current?.id != null ? selections[current.id] : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Flashcard" subtitle="Ders sec, hizli tekrar kartlariyla calis" />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <Card style={styles.card}>
          <Text style={styles.h2}>Ders Secimi</Text>
          <View style={styles.rowWrap}>
            {dersler.map((d) => (
              <PrimaryButton
                key={d.id}
                title={d.ad}
                onPress={() => setSelectedDersId(d.id)}
                style={[styles.smallBtn, selectedDersId === d.id && styles.activeBtn]}
              />
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.meta}>
            Kart {cards.length ? index + 1 : 0}/{cards.length}
          </Text>
          <Text style={styles.question}>{current?.metin || "Kart bulunamadi."}</Text>
          <View style={styles.optionsWrap}>
            {(current?.secenekler || []).map((opt, idx) => {
              const isSelected = selectedOptionId === opt.id;
              const isCorrect = opt?.dogru === true || opt?.dogru === 1;
              const showCorrectness = showAnswer || selectedOptionId != null;
              return (
                <Pressable
                  key={String(opt.id || idx)}
                  onPress={() =>
                    setSelections((prev) => ({
                      ...prev,
                      [current.id]: opt.id,
                    }))
                  }
                >
                  <Card
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionSelected,
                      showCorrectness && isCorrect && styles.optionCorrect,
                      showCorrectness && isSelected && !isCorrect && styles.optionWrong,
                    ]}
                  >
                    <Text style={styles.optionText}>{opt?.metin || "-"}</Text>
                    {showCorrectness && isCorrect ? <Text style={styles.optionBadge}>Dogru</Text> : null}
                    {showCorrectness && isSelected && !isCorrect ? <Text style={styles.optionBadgeWrong}>Senin secimin</Text> : null}
                  </Card>
                </Pressable>
              );
            })}
            {Array.isArray(current?.secenekler) && current.secenekler.length === 0 ? <Text style={styles.answer}>Cevap secenekleri bulunamadi.</Text> : null}
          </View>
          {showAnswer ? (
            <View style={styles.answerBox}>
              <Text style={styles.answerLabel}>Dogru Cevap</Text>
              <Text style={styles.answer}>{answerText}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <SecondaryButton
              title="Onceki"
              style={{ flex: 1 }}
              onPress={() => {
                setIndex((v) => Math.max(0, v - 1));
                setShowAnswer(false);
              }}
            />
            <PrimaryButton title={showAnswer ? "Gizle" : "Cevabi Goster"} style={{ flex: 1 }} onPress={() => setShowAnswer((v) => !v)} />
            <PrimaryButton
              title="Sonraki"
              style={{ flex: 1 }}
              onPress={() => {
                setIndex((v) => Math.min(cards.length - 1, v + 1));
                setShowAnswer(false);
              }}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { marginBottom: 10 },
  h2: { fontWeight: "700", fontSize: 16, color: colors.text, marginBottom: 8 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  smallBtn: { minWidth: 90, paddingVertical: 8 },
  activeBtn: { borderWidth: 2, borderColor: "#312e81" },
  meta: { color: colors.muted, fontWeight: "600", marginBottom: 8 },
  question: { color: colors.text, fontSize: 16, fontWeight: "700", lineHeight: 22 },
  optionsWrap: { marginTop: 10 },
  optionCard: { marginBottom: 8, padding: 10 },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionCorrect: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  optionWrong: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  optionText: { color: colors.text, fontWeight: "600" },
  optionBadge: { color: colors.success, fontSize: 11, marginTop: 4, fontWeight: "800" },
  optionBadgeWrong: { color: colors.danger, fontSize: 11, marginTop: 4, fontWeight: "800" },
  answerBox: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginTop: 10 },
  answerLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 },
  answer: { color: colors.text, lineHeight: 20 },
});
