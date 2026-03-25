import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { getJSON, setJSON } from "../services/storage";
import { colors } from "../theme";

const PRESETS = [15, 25, 40, 60];

export default function FocusTimerScreen() {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [mode, setMode] = useState("focus"); // focus | break
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(4);
  const [history, setHistory] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [savedSessions, savedHistory] = await Promise.all([
        getJSON("focus_sessions", 0),
        getJSON("focus_history", []),
      ]);
      setSessions(Number(savedSessions) || 0);
      setHistory(Array.isArray(savedHistory) ? savedHistory : []);
      const savedTarget = await getJSON("focus_daily_target", 4);
      setDailyTarget(Number(savedTarget) || 4);
    })();
  }, []);

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (mode === "focus") {
            setSessions((s) => {
              const next = s + 1;
              setJSON("focus_sessions", next);
              return next;
            });
            setHistory((prevHistory) => {
              const next = [
                { id: `h-${Date.now()}`, type: "Odak", minutes: focusMinutes, at: new Date().toISOString() },
                ...prevHistory,
              ].slice(0, 20);
              setJSON("focus_history", next);
              const today = new Date().toLocaleDateString("tr-TR");
              const todayCount = next.filter((h) => h.type === "Odak" && new Date(h.at).toLocaleDateString("tr-TR") === today).length;
              getJSON("focus_rewards", { xp: 0, gold: 0, rewardedDates: [] }).then((rewardState) => {
                const rewardedDates = Array.isArray(rewardState?.rewardedDates) ? rewardState.rewardedDates : [];
                if (todayCount >= dailyTarget && !rewardedDates.includes(today)) {
                  const updated = {
                    xp: Number(rewardState?.xp || 0) + 25,
                    gold: Number(rewardState?.gold || 0) + 3,
                    rewardedDates: [...rewardedDates, today],
                  };
                  setJSON("focus_rewards", updated);
                  Alert.alert("Gunluk hedef tamamlandi", "+25 XP ve +3 altin kazandin.");
                }
              });
              return next;
            });
            setMode("break");
            setSecondsLeft(breakMinutes * 60);
            setRunning(true);
            Alert.alert("Odak seansi bitti", "Kisa mola zamani.");
            return breakMinutes * 60;
          }

          setMode("focus");
          setSecondsLeft(focusMinutes * 60);
          setRunning(false);
          Alert.alert("Mola bitti", "Yeni odak seansina hazirsin.");
          return focusMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running, mode, focusMinutes, breakMinutes]);

  const mm = useMemo(() => String(Math.floor(secondsLeft / 60)).padStart(2, "0"), [secondsLeft]);
  const ss = useMemo(() => String(secondsLeft % 60).padStart(2, "0"), [secondsLeft]);
  const todaySessions = useMemo(
    () => history.filter((h) => h.type === "Odak" && new Date(h.at).toLocaleDateString("tr-TR") === new Date().toLocaleDateString("tr-TR")).length,
    [history]
  );

  function setPreset(min) {
    setRunning(false);
    setMode("focus");
    setFocusMinutes(min);
    setSecondsLeft(min * 60);
  }

  function reset() {
    setRunning(false);
    setMode("focus");
    setFocusMinutes(25);
    setBreakMinutes(5);
    setSecondsLeft(25 * 60);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Odak Zamanlayici" subtitle="Pomodoro ile odagini guclendir" />
      <Card style={styles.timerCard}>
        <Text style={styles.modeText}>{mode === "focus" ? "Odak Modu" : "Mola Modu"}</Text>
        <Text style={styles.timerText}>
          {mm}:{ss}
        </Text>
        <View style={styles.row}>
          <PrimaryButton title={running ? "Duraklat" : "Baslat"} style={{ flex: 1 }} onPress={() => setRunning((v) => !v)} />
          <SecondaryButton title="Sifirla" style={{ flex: 1 }} onPress={reset} />
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <SecondaryButton title="Hedef -1" style={{ flex: 1 }} onPress={() => {
            const next = Math.max(1, dailyTarget - 1);
            setDailyTarget(next);
            setJSON("focus_daily_target", next);
          }} />
          <SecondaryButton title="Hedef +1" style={{ flex: 1 }} onPress={() => {
            const next = Math.min(20, dailyTarget + 1);
            setDailyTarget(next);
            setJSON("focus_daily_target", next);
          }} />
        </View>
        <Text style={styles.meta}>Gunluk seans hedefi: {dailyTarget}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.h2}>Hazir Sureler</Text>
        <View style={styles.presets}>
          {PRESETS.map((min) => (
            <PrimaryButton key={min} title={`${min} dk`} style={{ flex: 1 }} onPress={() => setPreset(min)} />
          ))}
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <SecondaryButton title="Mola -1 dk" style={{ flex: 1 }} onPress={() => setBreakMinutes((v) => Math.max(1, v - 1))} />
          <SecondaryButton title="Mola +1 dk" style={{ flex: 1 }} onPress={() => setBreakMinutes((v) => Math.min(20, v + 1))} />
        </View>
        <Text style={styles.meta}>Mola suresi: {breakMinutes} dk</Text>
      </Card>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <Card style={styles.card}>
          <Text style={styles.h2}>Toplam Tamamlanan Seans</Text>
          <Text style={styles.sessionValue}>{sessions}</Text>
          <Text style={styles.meta}>Her tamamlanan odak seansi calisma ritmini guclendirir.</Text>
          <Text style={styles.meta}>
            Hedef ilerleme: {Math.min(todaySessions, dailyTarget)}/{dailyTarget}
          </Text>
        </Card>
        <Card style={styles.card}>
          <Text style={styles.h2}>Son Seanslar</Text>
          {history.length === 0 ? (
            <Text style={styles.meta}>Henuz kayit yok.</Text>
          ) : (
            history.map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <Text style={styles.historyMain}>
                  {h.type} - {h.minutes} dk
                </Text>
                <Text style={styles.historyMeta}>{new Date(h.at).toLocaleString("tr-TR")}</Text>
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
  timerCard: { marginBottom: 10, alignItems: "center" },
  modeText: { color: colors.muted, fontWeight: "700", marginBottom: 4 },
  timerText: { fontSize: 54, fontWeight: "800", color: colors.primary, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  card: { marginBottom: 10 },
  h2: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 8 },
  presets: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  sessionValue: { fontSize: 36, fontWeight: "800", color: colors.text },
  meta: { color: colors.muted, marginTop: 6 },
  historyRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyMain: { color: colors.text, fontWeight: "600" },
  historyMeta: { color: colors.muted, fontSize: 12, marginTop: 1 },
});
