import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchDenemeSinavlari, fetchDenemeSorular, submitQuiz } from "../services/quiz";
import { Card, PrimaryButton, ProgressBar, SecondaryButton, SectionTitle } from "../components/ui";
import { getJSON, setJSON } from "../services/storage";
import { colors } from "../theme";

export default function DenemeScreen({ navigation }) {
  const progressKey = "deneme_progress_active";
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("list"); // list | running | result
  const [denemeler, setDenemeler] = useState([]);
  const [sorular, setSorular] = useState([]);
  const [current, setCurrent] = useState(0);
  const [secimler, setSecimler] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [result, setResult] = useState(null);
  const [selectedDeneme, setSelectedDeneme] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [savedProgress, setSavedProgress] = useState(null);
  const grouped = useMemo(() => {
    const src = Array.isArray(denemeler) ? denemeler : [];
    const out = { tyt: [], ayt: [], diger: [] };
    src.forEach((d) => {
      const name = String(d?.adi || d?.deneme_adi || "").toLocaleUpperCase("tr-TR");
      if (name.includes("TYT")) out.tyt.push(d);
      else if (name.includes("AYT")) out.ayt.push(d);
      else out.diger.push(d);
    });
    return out;
  }, [denemeler]);

  const answeredCount = Object.keys(secimler).length;
  const blankCount = Math.max(0, sorular.length - answeredCount);

  function formatDuration(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  const loadDenemeler = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDenemeSinavlari();
      setDenemeler(data);
      const saved = await getJSON(progressKey, null);
      if (saved?.step === "running" && Array.isArray(saved?.sorular) && saved.sorular.length > 0) {
        setSavedProgress(saved);
      } else {
        setSavedProgress(null);
      }
    } catch {
      Alert.alert("Hata", "Deneme listesi alinamadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (step === "list") {
        loadDenemeler();
      }
    }, [loadDenemeler, step])
  );

  useEffect(() => {
    if (step !== "running" || !startedAt) return undefined;
    const id = setInterval(() => {
      const base = new Date(startedAt).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - base) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [step, startedAt]);

  useEffect(() => {
    if (step !== "running" || sorular.length === 0) return;
    setJSON(progressKey, {
      step: "running",
      selectedDeneme,
      sorular,
      current,
      secimler,
      flaggedQuestions: Array.from(flaggedQuestions),
      startedAt: startedAt?.toISOString?.() || startedAt || new Date().toISOString(),
      elapsedSeconds,
      savedAt: new Date().toISOString(),
    });
  }, [step, sorular, current, secimler, flaggedQuestions, startedAt, elapsedSeconds, selectedDeneme]);

  async function startDeneme(deneme) {
    const id = deneme?.id || deneme?.deneme_sinavi_id;
    if (!id) {
      Alert.alert("Hata", "Deneme ID bulunamadi.");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchDenemeSorular(id);
      if (!data.length) {
        Alert.alert("Bilgi", "Bu denemede soru bulunamadi.");
        return;
      }
      setSorular(data);
      setSelectedDeneme(deneme);
      setCurrent(0);
      setSecimler({});
      setFlaggedQuestions(new Set());
      setStartedAt(new Date());
      setElapsedSeconds(0);
      setStep("running");
    } catch {
      Alert.alert("Hata", "Deneme sorulari alinamadi.");
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    try {
      const payload = {
        items: sorular.map((s) => ({ soruId: s.id, secenekId: secimler[s.id] ?? null })),
        startedAt: startedAt?.toISOString() || new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      };
      const data = await submitQuiz(payload);
      setResult(data);
      setStep("result");
      await setJSON(progressKey, null);
      setSavedProgress(null);
    } catch {
      Alert.alert("Hata", "Deneme sonucu gonderilemedi.");
    }
  }

  function confirmFinish() {
    Alert.alert("Denemeyi Bitir", "Denemeyi simdi bitirmek istiyor musun?", [
      { text: "Iptal", style: "cancel" },
      { text: "Bitir", style: "destructive", onPress: finish },
    ]);
  }

  function clearAnswer(soruId) {
    setSecimler((prev) => {
      const next = { ...prev };
      delete next[soruId];
      return next;
    });
  }

  function toggleFlag(soruId) {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(soruId)) next.delete(soruId);
      else next.add(soruId);
      return next;
    });
  }

  function restoreSavedProgress() {
    if (!savedProgress?.sorular?.length) return;
    setSelectedDeneme(savedProgress.selectedDeneme || null);
    setSorular(savedProgress.sorular);
    setCurrent(Number(savedProgress.current || 0));
    setSecimler(savedProgress.secimler || {});
    setFlaggedQuestions(new Set(Array.isArray(savedProgress.flaggedQuestions) ? savedProgress.flaggedQuestions : []));
    const started = savedProgress.startedAt ? new Date(savedProgress.startedAt) : new Date();
    setStartedAt(started);
    setElapsedSeconds(Number(savedProgress.elapsedSeconds || 0));
    setStep("running");
    setSavedProgress(null);
  }

  async function discardSavedProgress() {
    await setJSON(progressKey, null);
    setSavedProgress(null);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (step === "list") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <SecondaryButton title="Geri" onPress={() => navigation.navigate("MainTabs", { screen: "HomeTab" })} style={styles.backBtnTop} />
          <Text style={styles.topTitle}>Deneme Sinavlari</Text>
        </View>
        <SectionTitle title="Deneme Sinavlari" subtitle="TYT/AYT denemelerini mobilde coz." />
        {savedProgress ? (
          <Card style={styles.restoreCard}>
            <Text style={styles.restoreTitle}>Kaldigin deneme bulundu</Text>
            <Text style={styles.restoreMeta}>
              {(savedProgress?.selectedDeneme?.adi || savedProgress?.selectedDeneme?.deneme_adi || "Deneme")} | Soru {Number(savedProgress.current || 0) + 1}/
              {savedProgress.sorular?.length || 0}
            </Text>
            <View style={styles.restoreRow}>
              <PrimaryButton title="Devam Et" style={{ flex: 1 }} onPress={restoreSavedProgress} />
              <SecondaryButton title="Sil" style={{ flex: 1 }} onPress={discardSavedProgress} />
            </View>
          </Card>
        ) : null}
        <PrimaryButton title="Listeyi Yenile" onPress={loadDenemeler} style={{ marginBottom: 10 }} />
        <FlatList
          data={[
            ...grouped.tyt.map((x) => ({ ...x, _group: "TYT Denemeleri" })),
            ...grouped.ayt.map((x) => ({ ...x, _group: "AYT Denemeleri" })),
            ...grouped.diger.map((x) => ({ ...x, _group: "Diger Denemeler" })),
          ]}
          keyExtractor={(item, idx) => String(item.id || item.deneme_sinavi_id || idx)}
          ListEmptyComponent={<Text style={styles.empty}>Deneme bulunamadi.</Text>}
          renderItem={({ item, index }) => {
            const prev = index > 0 ? ([...grouped.tyt, ...grouped.ayt, ...grouped.diger][index - 1]) : null;
            const currentGroup = item._group;
            const prevGroup = (() => {
              if (!prev) return null;
              const n = String(prev?.adi || prev?.deneme_adi || "").toLocaleUpperCase("tr-TR");
              if (n.includes("TYT")) return "TYT Denemeleri";
              if (n.includes("AYT")) return "AYT Denemeleri";
              return "Diger Denemeler";
            })();
            const showHeader = currentGroup !== prevGroup;
            return (
              <>
                {showHeader ? <Text style={styles.groupTitle}>{currentGroup}</Text> : null}
                <Card style={styles.card}>
                  <Text style={styles.cardTitle}>{item.adi || item.deneme_adi || "Deneme"}</Text>
                  <PrimaryButton title="Baslat" onPress={() => startDeneme(item)} />
                </Card>
              </>
            );
          }}
        />
      </SafeAreaView>
    );
  }

  if (step === "result" && result) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <SectionTitle title="Deneme Tamamlandi" subtitle={selectedDeneme?.adi || selectedDeneme?.deneme_adi || "Sonucun basariyla kaydedildi."} />
        <Card style={styles.card}>
          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{result.total ?? 0}</Text>
              <Text style={styles.metricLabel}>Soru</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={[styles.metricValue, { color: colors.success }]}>{result.correct ?? 0}</Text>
              <Text style={styles.metricLabel}>Dogru</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={[styles.metricValue, { color: colors.danger }]}>{result.wrong ?? 0}</Text>
              <Text style={styles.metricLabel}>Yanlis</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{Math.max(0, (result.total ?? 0) - (result.correct ?? 0) - (result.wrong ?? 0))}</Text>
              <Text style={styles.metricLabel}>Bos</Text>
            </View>
          </View>
          <Text style={styles.resultNet}>Net: {(Number(result.correct || 0) - Number(result.wrong || 0) / 4).toFixed(2)}</Text>
          <Text style={styles.resultNet}>Sure: {formatDuration(elapsedSeconds)}</Text>
          <ProgressBar value={(Number(result.correct || 0) / Math.max(1, Number(result.total || 0))) * 100} height={10} />
        </Card>
        {result?.oturumId ? (
          <PrimaryButton title="Rapor Detayina Git" onPress={() => navigation.navigate("ReportDetail", { oturumId: result.oturumId })} style={{ marginBottom: 8 }} />
        ) : null}
        <PrimaryButton
          title="Listeye Don"
          onPress={() => {
            setStep("list");
            setResult(null);
            setSorular([]);
            setSelectedDeneme(null);
            setSecimler({});
            setFlaggedQuestions(new Set());
            setCurrent(0);
            setElapsedSeconds(0);
            setJSON(progressKey, null);
          }}
        />
      </SafeAreaView>
    );
  }

  const soru = sorular[current];
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <SecondaryButton title="Geri" onPress={() => setStep("list")} style={styles.backBtnTop} />
        <Text style={styles.topTitle}>Deneme Cozumu</Text>
      </View>
      <Text style={styles.meta}>Soru {current + 1}/{sorular.length}</Text>
      <ProgressBar value={((current + 1) / Math.max(1, sorular.length)) * 100} height={9} />
      <View style={styles.progressMetaRow}>
        <Text style={styles.progressMeta}>Ilerleme %{Math.round(((current + 1) / Math.max(1, sorular.length)) * 100)}</Text>
        <Text style={styles.progressMeta}>Cevaplanan {answeredCount}/{sorular.length}</Text>
      </View>
      <Text style={styles.timerMeta}>Sure: {formatDuration(elapsedSeconds)}</Text>
      <View style={styles.statsMiniRow}>
        <Text style={styles.statsMini}>Cevapli: {answeredCount}</Text>
        <Text style={styles.statsMini}>Bos: {blankCount}</Text>
        <Text style={styles.statsMini}>Isaretli: {flaggedQuestions.size}</Text>
      </View>
      <Card style={styles.card}>
        <View style={styles.questionTopRow}>
          <Text style={styles.meta}>Soru #{current + 1}</Text>
          <View style={styles.questionActionRow}>
            <Pressable onPress={() => clearAnswer(soru?.id)} disabled={!secimler[soru?.id]}>
              <Text style={[styles.inlineAction, !secimler[soru?.id] && styles.inlineActionDisabled]}>Bos Birak</Text>
            </Pressable>
            <Pressable onPress={() => toggleFlag(soru?.id)}>
              <Text style={[styles.inlineAction, flaggedQuestions.has(soru?.id) && { color: "#b45309" }]}>
                {flaggedQuestions.has(soru?.id) ? "Isaretli" : "Isaretle"}
              </Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.question}>{soru?.metin || "Soru metni yok"}</Text>
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
      <FlatList
        data={soru?.secenekler || []}
        keyExtractor={(item, idx) => String(item.id || idx)}
        renderItem={({ item }) => {
          const selected = secimler[soru.id] === item.id;
          return (
            <Pressable onPress={() => setSecimler((p) => ({ ...p, [soru.id]: item.id }))}>
              <Card style={[styles.option, selected && styles.optionSelected]}>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{item.metin}</Text>
              </Card>
            </Pressable>
          );
        }}
      />
      <View style={styles.row}>
        <SecondaryButton title="Onceki" style={{ flex: 1 }} disabled={current === 0} onPress={() => setCurrent((v) => Math.max(0, v - 1))} />
        <PrimaryButton title="Sonraki" style={{ flex: 1 }} disabled={current === sorular.length - 1} onPress={() => setCurrent((v) => Math.min(sorular.length - 1, v + 1))} />
      </View>
      <View style={styles.finishWrap}>
        <PrimaryButton title="DENEMEYI TAMAMLA" style={styles.finishBtn} onPress={confirmFinish} />
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
  topTitle: { color: "#fff", fontWeight: "800", fontSize: 16, flex: 1 },
  backBtnTop: { minWidth: 72, backgroundColor: "rgba(255,255,255,0.22)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: "#6b7280" },
  groupTitle: { color: colors.primary, fontWeight: "800", fontSize: 13, marginBottom: 6, marginTop: 4 },
  meta: { fontWeight: "700", marginBottom: 8, color: colors.muted },
  progressMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  progressMeta: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  timerMeta: { color: colors.primary, fontWeight: "800", fontSize: 12, marginBottom: 8 },
  statsMiniRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  statsMini: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  card: { marginBottom: 10 },
  restoreCard: { marginBottom: 10 },
  restoreTitle: { color: colors.text, fontWeight: "800", marginBottom: 4 },
  restoreMeta: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  restoreRow: { flexDirection: "row", gap: 8 },
  cardTitle: { fontWeight: "700", marginBottom: 8 },
  question: { fontSize: 16, fontWeight: "600" },
  questionTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  questionActionRow: { flexDirection: "row", gap: 10 },
  inlineAction: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  inlineActionDisabled: { color: colors.muted },
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
  option: { marginBottom: 8, padding: 12 },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { color: "#111827" },
  optionTextSelected: { color: colors.primary, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  finishWrap: { marginTop: 10, marginBottom: 2 },
  finishBtn: { backgroundColor: colors.danger },
  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  metricPill: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, alignItems: "center" },
  metricValue: { color: colors.text, fontWeight: "800", fontSize: 14 },
  metricLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  resultNet: { color: colors.text, fontWeight: "800", marginBottom: 8 },
});
