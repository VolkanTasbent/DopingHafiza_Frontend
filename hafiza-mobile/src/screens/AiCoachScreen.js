import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { fetchAiAbCompare, fetchAiStudyPlan, fetchAiWeakTopics, sendAiChat } from "../services/quiz";
import { loadSavedPlans, removeSavedPlan, saveStudyPlanEntry } from "../services/aiCoachStorage";
import { colors } from "../theme";

const PRESET_PROMPTS = [
  { label: "Eksiklerim neler?", text: "Eksiklerim neler?" },
  { label: "30 dk plan", text: "30 dakikada hizli plan hazirla" },
  { label: "Deneme analizi", text: "Deneme analizi yap" },
  { label: "Bugun program", text: "Bugun calisma programi olustur" },
];

export default function AiCoachScreen({ navigation }) {
  const scrollRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [dailyMinutes, setDailyMinutes] = useState("120");
  const [analysis, setAnalysis] = useState(null);
  const [plan, setPlan] = useState(null);
  const [abCompare, setAbCompare] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [sending, setSending] = useState(false);
  const [savedPlans, setSavedPlans] = useState([]);

  const reloadSaved = useCallback(async () => {
    try {
      const list = await loadSavedPlans();
      setSavedPlans(list);
    } catch {
      setSavedPlans([]);
    }
  }, []);

  async function load() {
    setLoading(true);
    try {
      const dayNum = Math.max(7, Number(days || 30));
      const minuteNum = Math.max(30, Number(dailyMinutes || 120));
      const [a, p] = await Promise.all([
        fetchAiWeakTopics({ days: dayNum, limit: 8 }),
        fetchAiStudyPlan({ days: dayNum, dailyMinutes: minuteNum, mode: "mixed" }),
      ]);
      setAnalysis(a);
      setPlan(p);
      try {
        const ab = await fetchAiAbCompare({ days: dayNum, limit: 6 });
        setAbCompare(ab);
      } catch {
        setAbCompare(null);
      }
    } catch (e) {
      Alert.alert("Hata", "AI analiz verisi alinamadi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    reloadSaved();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd?.({ animated: true });
  }, [messages]);

  async function sendChat(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    setSending(true);
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setMessage("");
    try {
      const res = await sendAiChat(trimmed);
      const answer = res?.answer || "";
      const qr = Array.isArray(res?.quickReplies) ? res.quickReplies : [];
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
      setQuickReplies(qr);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Baglanti hatasi. Internet ve backend (8085) acik mi kontrol et." }]);
    } finally {
      setSending(false);
    }
  }

  async function onSend() {
    await sendChat(message);
  }

  async function onSavePlan() {
    if (!plan?.tasks?.length) {
      Alert.alert("Bilgi", "Once analizi yenile; kaydedilecek program yok.");
      return;
    }
    try {
      await saveStudyPlanEntry(plan, analysis, {});
      await reloadSaved();
      Alert.alert("Tamam", "Program sunucuya kaydedildi. Asagida 'Kayitli programlarim' bolumunden gorebilirsin.");
    } catch {
      Alert.alert("Hata", "Kayit basarisiz. Giris yaptigindan ve backend acik oldugundan emin ol.");
    }
  }

  async function onDeleteSaved(id) {
    try {
      await removeSavedPlan(id);
      await reloadSaved();
    } catch {
      Alert.alert("Hata", "Silinemedi.");
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="AI Ders Kocu" subtitle="Sohbet, eksik analizi ve kayitli programlar" />
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <SecondaryButton
          title="Haftalik calisma programi takvimi"
          onPress={() => navigation.navigate("CalismaProgrami")}
          style={{ marginBottom: 10 }}
        />
        <Card style={styles.heroCard}>
          <Text style={styles.heroTitle}>Bugun neye odaklanmaliyim?</Text>
          <Text style={styles.heroSub}>Asistan mesajlari gercek performans verine gore uretir; asagidan hazir sorularla da devam edebilirsin.</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Analiz</Text>
              <Text style={styles.metricValue}>{analysis?.analyzedDays || Number(days || 0)} gun</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Basari</Text>
              <Text style={styles.metricValue}>%{analysis?.overallSuccessRate ?? "-"}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Cevap</Text>
              <Text style={styles.metricValue}>{analysis?.totalAnswers ?? 0}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>AI Asistan sohbeti</Text>
          <Text style={styles.hint}>Hazir aksiyonlar mesaji otomatik gonderir. Cevaplar cok satirli olabilir.</Text>
          <View style={styles.presetRow}>
            {PRESET_PROMPTS.map((p) => (
              <Pressable key={p.label} style={styles.presetChip} onPress={() => sendChat(p.text)} disabled={sending}>
                <Text style={styles.presetChipText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          {messages.length > 0 ? (
            <View style={styles.thread}>
              {messages.map((msg, idx) => (
                <View
                  key={`m-${idx}`}
                  style={[styles.bubble, msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}
                >
                  <Text style={msg.role === "user" ? styles.bubbleUserText : styles.bubbleAssistantText}>{msg.text}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>Henuz mesaj yok. Yukaridaki hazir sorulardan birine dokun veya asagiya yaz.</Text>
          )}
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Mesaj yaz..."
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={onSend}
            />
            <PrimaryButton title={sending ? "..." : "Gonder"} onPress={onSend} style={{ flex: 0, minWidth: 88 }} disabled={sending} />
          </View>
          {quickReplies.length > 0 ? (
            <View style={styles.quickWrap}>
              <Text style={styles.quickLabel}>Onerilen sonraki sorular</Text>
              <View style={styles.presetRow}>
                {quickReplies.map((q) => (
                  <Pressable key={q} style={styles.quickChip} onPress={() => sendChat(q)} disabled={sending}>
                    <Text style={styles.quickChipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Kayitli calisma programlarim</Text>
          <Text style={styles.hint}>Programlar hesabina bagli olarak sunucuda saklanir (en fazla 20 kayit).</Text>
          {savedPlans.length === 0 ? (
            <Text style={styles.muted}>Henuz kayitli program yok.</Text>
          ) : (
            savedPlans.map((sp) => (
              <View key={sp.id} style={styles.savedBlock}>
                <View style={styles.savedHead}>
                  <Text style={styles.savedTitle}>{sp.title}</Text>
                  <Pressable onPress={() => onDeleteSaved(sp.id)}>
                    <Text style={styles.deleteLink}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.savedDate}>{new Date(sp.savedAt).toLocaleString("tr-TR")}</Text>
                <Text style={styles.desc}>{sp.summary}</Text>
                {(sp.tasks || []).slice(0, 6).map((t, i) => (
                  <Text key={`${sp.id}-t-${i}`} style={styles.savedTask}>
                    {i + 1}. {t.title} ({t.estimatedMinutes} dk)
                  </Text>
                ))}
              </View>
            ))
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Ayarlar</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Analiz gunu"
              keyboardType="number-pad"
              value={days}
              onChangeText={setDays}
            />
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Gunluk dakika"
              keyboardType="number-pad"
              value={dailyMinutes}
              onChangeText={setDailyMinutes}
            />
          </View>
          <PrimaryButton title={loading ? "Yukleniyor..." : "Analizi ve programi yenile"} onPress={load} disabled={loading} />
        </Card>

        <Card style={styles.card}>
          <View style={styles.planHead}>
            <Text style={styles.h2}>Kisisel programim</Text>
            <SecondaryButton title="Kaydet" onPress={onSavePlan} disabled={loading || !plan?.tasks?.length} />
          </View>
          <Text style={styles.desc}>{plan?.summary || "Program henuz olusturulmadi."}</Text>
          {(plan?.tasks || []).map((task, idx) => (
            <View key={`${task.title}-${idx}`} style={styles.item}>
              <Text style={styles.title}>
                {idx + 1}. {task.title}
              </Text>
              <Text style={styles.meta}>
                {task.taskType} | {task.estimatedMinutes} dk
              </Text>
              <Text style={styles.desc}>{task.description}</Text>
            </View>
          ))}
        </Card>

        {(analysis?.focusTips || []).length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.h2}>Odak onerileri</Text>
            {(analysis.focusTips || []).map((tip, i) => (
              <Text key={`tip-${i}`} style={styles.desc}>
                • {tip}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.h2}>Eksik konularim</Text>
          {(analysis?.weakTopics || []).length === 0 ? (
            <Text style={styles.muted}>Yeterli veri bulunamadi.</Text>
          ) : (
            (analysis?.weakTopics || []).map((t, idx) => (
              <View key={`${t.konuId || idx}`} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.title}>
                    {t.dersAd} / {t.konuAd}
                  </Text>
                  <Text style={styles.riskBadge}>Risk %{t.riskScore}</Text>
                </View>
                <Text style={styles.meta}>
                  Basari: %{t.successRate} | Kaynak: {t.source || "heuristic"}
                  {t.modelVersion ? ` (${t.modelVersion})` : ""}
                </Text>
                <Text style={styles.desc}>{t.recommendation}</Text>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>A/B Karsilastirma</Text>
          {(abCompare?.topics || []).length === 0 ? (
            <Text style={styles.muted}>A/B verisi su an kullanilamiyor.</Text>
          ) : (
            (abCompare?.topics || []).map((x, idx) => (
              <View key={`${x.konuId || idx}`} style={styles.item}>
                <Text style={styles.title}>
                  {x.dersAd} / {x.konuAd}
                </Text>
                <Text style={styles.meta}>
                  H:%{x.heuristicRisk} | ML:%{x.mlRisk ?? "-"} | Delta:
                  <Text style={[styles.delta, Number(x.delta || 0) >= 0 ? styles.deltaUp : styles.deltaDown]}>{x.delta ?? "-"}</Text> | Aktif:{x.activeSource}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { marginBottom: 10, borderRadius: 16 },
  heroCard: { marginBottom: 10, backgroundColor: "#111827", borderColor: "#1f2937", borderWidth: 1, borderRadius: 16 },
  heroTitle: { color: "#fff", fontWeight: "800", fontSize: 17, marginBottom: 4 },
  heroSub: { color: "#cbd5e1", fontSize: 12, marginBottom: 10 },
  metricsRow: { flexDirection: "row", gap: 8 },
  metricPill: { flex: 1, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", paddingVertical: 8, paddingHorizontal: 10 },
  metricLabel: { color: "#cbd5e1", fontSize: 11, fontWeight: "600" },
  metricValue: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 1 },
  h2: { color: colors.text, fontWeight: "800", marginBottom: 6 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  presetChip: { backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  presetChipText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  thread: { marginBottom: 10 },
  bubble: { maxWidth: "92%", padding: 12, borderRadius: 14, marginBottom: 8 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: colors.primary },
  bubbleAssistant: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  bubbleUserText: { color: "#fff", fontSize: 14, lineHeight: 20 },
  bubbleAssistantText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  quickWrap: { marginTop: 4 },
  quickLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 6 },
  quickChip: { backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#e2e8f0" },
  quickChipText: { color: colors.text, fontSize: 11, fontWeight: "600" },
  savedBlock: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, marginBottom: 10, backgroundColor: "#fafbff" },
  savedHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  savedTitle: { fontWeight: "800", color: colors.text, flex: 1 },
  savedDate: { color: colors.muted, fontSize: 11, marginBottom: 6 },
  savedTask: { color: colors.muted, fontSize: 12, marginTop: 2 },
  deleteLink: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  planHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 },
  item: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: colors.text, fontWeight: "700" },
  riskBadge: { color: "#7c2d12", backgroundColor: "#ffedd5", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  delta: { fontWeight: "800" },
  deltaUp: { color: "#0f766e" },
  deltaDown: { color: "#b91c1c" },
  desc: { color: colors.text, fontSize: 13, marginTop: 4 },
  muted: { color: colors.muted, fontSize: 13 },
});
