import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchKonular, fetchSorular, submitQuiz } from "../services/quiz";
import { Card, PrimaryButton, ProgressBar, SecondaryButton, SectionTitle } from "../components/ui";
import { getJSON, setJSON } from "../services/storage";
import { colors } from "../theme";

export default function QuizScreen({ route, navigation }) {
  const ders = route?.params?.ders;
  const progressKey = `quiz_progress_${ders?.id || "genel"}`;
  const [konular, setKonular] = useState([]);
  const [konuId, setKonuId] = useState(null);
  const [step, setStep] = useState("setup"); // setup | running | result
  const [loading, setLoading] = useState(true);
  const [sorular, setSorular] = useState([]);
  const [current, setCurrent] = useState(0);
  const [secimler, setSecimler] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [result, setResult] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [savedProgress, setSavedProgress] = useState(null);
  const startedAtRef = useRef(null);

  function formatDuration(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  useEffect(() => {
    navigation.setOptions({ title: `${ders?.ad || "Ders"} - Soru Coz` });
  }, [ders, navigation]);

  useEffect(() => {
    (async () => {
      try {
        if (!ders?.id) throw new Error("Ders bulunamadi.");
        const data = await fetchKonular(ders.id);
        setKonular(data);
        const saved = await getJSON(progressKey, null);
        if (saved?.step === "running" && Array.isArray(saved?.sorular) && saved.sorular.length > 0) {
          setSavedProgress(saved);
        } else {
          setSavedProgress(null);
        }
      } catch {
        Alert.alert("Hata", "Konular alinamadi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [ders, progressKey]);

  const currentQuestion = sorular[current];

  const summary = useMemo(() => {
    const answered = Object.keys(secimler).length;
    return { answered, total: sorular.length };
  }, [secimler, sorular.length]);

  useEffect(() => {
    if (step !== "running") return;
    const id = setInterval(() => {
      const started = startedAtRef.current ? new Date(startedAtRef.current).getTime() : Date.now();
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - started) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (step !== "running" || sorular.length === 0) return;
    const payload = {
      step: "running",
      dersId: ders?.id || null,
      konuId,
      sorular,
      secimler,
      current,
      flaggedQuestions: Array.from(flaggedQuestions),
      startedAt: startedAtRef.current?.toISOString?.() || startedAtRef.current || new Date().toISOString(),
      elapsedSeconds,
      savedAt: new Date().toISOString(),
    };
    setJSON(progressKey, payload);
  }, [step, sorular, secimler, current, flaggedQuestions, startedAtRef, elapsedSeconds, ders?.id, konuId, progressKey]);

  async function loadQuestions() {
    setLoading(true);
    try {
      const data = await fetchSorular({ dersId: ders.id, konuId });
      if (!data.length) {
        Alert.alert("Bilgi", "Bu filtrede soru bulunamadi.");
        return;
      }
      setSorular(data);
      setCurrent(0);
      setSecimler({});
      setFlaggedQuestions(new Set());
      setStep("running");
      startedAtRef.current = new Date();
      setElapsedSeconds(0);
    } catch {
      Alert.alert("Hata", "Sorular alinamadi.");
    } finally {
      setLoading(false);
    }
  }

  async function finishQuiz() {
    try {
      const payload = {
        items: sorular.map((s) => ({
          soruId: s.id,
          secenekId: secimler[s.id] ?? null,
        })),
        startedAt: startedAtRef.current?.toISOString() || new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      };
      const data = await submitQuiz(payload);
      setResult(data);
      setStep("result");
      await setJSON(progressKey, null);
      setSavedProgress(null);
    } catch (e) {
      const errMsg = e?.response?.data?.message || "Test gonderilemedi.";
      Alert.alert("Hata", String(errMsg));
    }
  }

  function confirmFinishQuiz() {
    Alert.alert("Testi Bitir", "Testi simdi bitirmek istiyor musun?", [
      { text: "Iptal", style: "cancel" },
      { text: "Bitir", style: "destructive", onPress: finishQuiz },
    ]);
  }

  function clearAnswer(soruId) {
    setSecimler((prev) => {
      const next = { ...prev };
      delete next[soruId];
      return next;
    });
  }

  function restoreSavedProgress() {
    if (!savedProgress?.sorular?.length) return;
    setSorular(savedProgress.sorular);
    setKonuId(savedProgress.konuId ?? null);
    setSecimler(savedProgress.secimler || {});
    setCurrent(Number(savedProgress.current || 0));
    setFlaggedQuestions(new Set(Array.isArray(savedProgress.flaggedQuestions) ? savedProgress.flaggedQuestions : []));
    const started = savedProgress.startedAt ? new Date(savedProgress.startedAt) : new Date();
    startedAtRef.current = started;
    setElapsedSeconds(Number(savedProgress.elapsedSeconds || 0));
    setStep("running");
    setSavedProgress(null);
  }

  async function discardSavedProgress() {
    await setJSON(progressKey, null);
    setSavedProgress(null);
  }

  function toggleFlag(soruId) {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(soruId)) next.delete(soruId);
      else next.add(soruId);
      return next;
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (step === "setup") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <SecondaryButton title="Geri" onPress={() => navigation.goBack()} style={styles.backBtn} />
          <Text style={styles.topTitle}>{ders?.ad || "Ders"}</Text>
        </View>
        <SectionTitle title={ders?.ad || "Soru Coz"} subtitle="Konu secerek ya da tum konulardan test baslat." />
        {savedProgress ? (
          <Card style={styles.restoreCard}>
            <Text style={styles.restoreTitle}>Kaldigin test bulundu</Text>
            <Text style={styles.restoreMeta}>
              Soru {Number(savedProgress.current || 0) + 1}/{savedProgress.sorular?.length || 0} | Cevapli {Object.keys(savedProgress.secimler || {}).length}
            </Text>
            <View style={styles.restoreRow}>
              <PrimaryButton title="Devam Et" style={{ flex: 1 }} onPress={restoreSavedProgress} />
              <SecondaryButton title="Sil" style={{ flex: 1 }} onPress={discardSavedProgress} />
            </View>
          </Card>
        ) : null}
        <ScrollView style={{ flex: 1 }}>
          <Pressable onPress={() => setKonuId(null)}>
            <Card style={[styles.konuBtn, !konuId && styles.konuBtnActive]}>
              <Text style={[styles.konuText, !konuId && styles.konuTextActive]}>Tum Konular</Text>
            </Card>
          </Pressable>
          {konular.map((k) => (
            <Pressable key={k.id} onPress={() => setKonuId(k.id)}>
              <Card style={[styles.konuBtn, konuId === k.id && styles.konuBtnActive]}>
                <Text style={[styles.konuText, konuId === k.id && styles.konuTextActive]}>{k.ad}</Text>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
        <PrimaryButton title="Sorulari Getir" onPress={loadQuestions} />
      </SafeAreaView>
    );
  }

  if (step === "result" && result) {
    const dogru = Number(result.correct ?? 0);
    const yanlis = Number(result.wrong ?? 0);
    const toplam = Number(result.total ?? 0);
    const bos = Math.max(0, toplam - dogru - yanlis);
    const net = (dogru - yanlis / 4).toFixed(2);
    const ratio = toplam > 0 ? Math.round((dogru / toplam) * 100) : 0;
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <SectionTitle title="Test Tamamlandi" subtitle="Sonucun anlik olarak kaydedildi." />
        <Card style={styles.resultCard}>
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
          <Text style={styles.resultItem}>Net: {net} | Basari: %{ratio}</Text>
          <Text style={styles.resultItem}>Sure: {formatDuration(elapsedSeconds)}</Text>
          <ProgressBar value={ratio} height={10} />
        </Card>
        {result?.oturumId ? (
          <PrimaryButton title="Rapor Detayina Git" onPress={() => navigation.navigate("ReportDetail", { oturumId: result.oturumId })} style={{ marginBottom: 8 }} />
        ) : null}
        <PrimaryButton title="Derslere Don" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const currentSoruId = currentQuestion?.id;
  const answered = summary.answered;
  const flaggedCount = flaggedQuestions.size;
  const blankCount = Math.max(0, sorular.length - answered);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <SecondaryButton title="Geri" onPress={() => setStep("setup")} style={styles.backBtn} />
        <Text style={styles.topTitle}>Soru Cozumu</Text>
      </View>
      <Text style={styles.meta}>
        Soru {current + 1}/{sorular.length} - Cevaplanan: {summary.answered}
      </Text>
      <ProgressBar value={((current + 1) / Math.max(1, sorular.length)) * 100} height={9} />
      <View style={styles.progressMetaRow}>
        <Text style={styles.progressMeta}>Ilerleme %{Math.round(((current + 1) / Math.max(1, sorular.length)) * 100)}</Text>
        <Text style={styles.progressMeta}>Cevaplanan {summary.answered}/{sorular.length}</Text>
      </View>
      <Text style={styles.timerMeta}>Sure: {formatDuration(elapsedSeconds)}</Text>
      <View style={styles.statsMiniRow}>
        <Text style={styles.statsMini}>Cevapli: {answered}</Text>
        <Text style={styles.statsMini}>Bos: {blankCount}</Text>
        <Text style={styles.statsMini}>Isaretli: {flaggedCount}</Text>
      </View>
      <Card style={styles.questionCard}>
        <View style={styles.questionTopRow}>
          <Text style={styles.meta}>Soru #{current + 1}</Text>
          <View style={styles.questionActionRow}>
            <Pressable onPress={() => clearAnswer(currentSoruId)} disabled={!secimler[currentSoruId]}>
              <Text style={[styles.inlineAction, !secimler[currentSoruId] && styles.inlineActionDisabled]}>Bos Birak</Text>
            </Pressable>
            <Pressable onPress={() => toggleFlag(currentSoruId)}>
              <Text style={[styles.inlineAction, flaggedQuestions.has(currentSoruId) && { color: "#b45309" }]}>
                {flaggedQuestions.has(currentSoruId) ? "Isaretli" : "Isaretle"}
              </Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.questionText}>{currentQuestion?.metin}</Text>
      </Card>

      <View style={styles.paletteWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteRow}>
          {sorular.map((s, idx) => {
            const isCurrent = idx === current;
            const isAnswered = secimler[s.id] != null;
            const isFlagged = flaggedQuestions.has(s.id);
            return (
              <Pressable
                key={String(s.id || idx)}
                style={[styles.paletteItem, isCurrent && styles.paletteCurrent, isAnswered && styles.paletteAnswered, isFlagged && styles.paletteFlagged]}
                onPress={() => setCurrent(idx)}
              >
                <Text style={[styles.paletteText, isCurrent && styles.paletteTextCurrent]}>{idx + 1}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {(currentQuestion?.secenekler || []).map((opt) => {
          const selected = secimler[currentQuestion.id] === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() =>
                setSecimler((prev) => ({
                  ...prev,
                  [currentQuestion.id]: opt.id,
                }))
              }
            >
              <Card style={[styles.optionBtn, selected && styles.optionBtnSelected]}>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt.metin}</Text>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.bottomActions}>
        <SecondaryButton title="Onceki" disabled={current === 0} style={{ flex: 1 }} onPress={() => setCurrent((v) => Math.max(0, v - 1))} />
        <PrimaryButton title="Sonraki" style={{ flex: 1 }} onPress={() => setCurrent((v) => Math.min(sorular.length - 1, v + 1))} disabled={current === sorular.length - 1} />
      </View>
      <View style={styles.finishWrap}>
        <PrimaryButton title="TESTI TAMAMLA" style={styles.finishBtn} onPress={confirmFinishQuiz} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  topBar: {
    backgroundColor: "#ff4f5a",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: { minWidth: 72, backgroundColor: "rgba(255,255,255,0.22)" },
  topTitle: { color: "#fff", fontWeight: "800", fontSize: 16, flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  meta: { color: colors.muted, marginBottom: 10, fontWeight: "700" },
  progressMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  progressMeta: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  timerMeta: { color: colors.primary, fontSize: 12, fontWeight: "800", marginBottom: 8 },
  statsMiniRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  statsMini: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  konuBtn: { marginBottom: 8 },
  konuBtnActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  konuText: { color: "#111827" },
  konuTextActive: { color: colors.primary, fontWeight: "800" },
  questionCard: { marginBottom: 12 },
  restoreCard: { marginBottom: 10 },
  restoreTitle: { color: colors.text, fontWeight: "800", marginBottom: 4 },
  restoreMeta: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  restoreRow: { flexDirection: "row", gap: 8 },
  questionTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  questionActionRow: { flexDirection: "row", gap: 10 },
  inlineAction: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  inlineActionDisabled: { color: colors.muted },
  questionText: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  paletteWrap: { marginBottom: 8 },
  paletteRow: { gap: 6, paddingRight: 10 },
  paletteItem: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  paletteCurrent: { borderColor: colors.primary, borderWidth: 2 },
  paletteAnswered: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  paletteFlagged: { backgroundColor: "#fef3c7", borderColor: "#fcd34d" },
  paletteText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  paletteTextCurrent: { color: colors.primary, fontWeight: "800" },
  optionBtn: { marginBottom: 8, padding: 12 },
  optionBtnSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  optionText: { color: "#111827" },
  optionTextSelected: { color: colors.primary, fontWeight: "700" },
  bottomActions: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 10 },
  finishWrap: { marginTop: 10, marginBottom: 2 },
  finishBtn: { backgroundColor: colors.danger },
  resultCard: { gap: 8, marginBottom: 12 },
  resultItem: { fontSize: 16, fontWeight: "600" },
  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  metricPill: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, alignItems: "center" },
  metricValue: { color: colors.text, fontWeight: "800", fontSize: 14 },
  metricLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
