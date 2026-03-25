import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Card, PrimaryButton, SectionTitle, SecondaryButton } from "../components/ui";
import {
  createSecenek,
  createSoru,
  fetchAiWeakTopics,
  fetchDenemeSinavlari,
  fetchDersler,
  fetchKonular,
  fetchRaporlar,
  fetchSoruDetay,
  fetchSorular,
  removeSecenek,
  removeSoru,
  updateSecenek,
  updateSoru,
} from "../services/quiz";
import { colors } from "../theme";

export default function AdminScreen({ navigation }) {
  const scrollRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ ders: 0, konu: 0, soru: 0, deneme: 0, rapor: 0 });
  const [dersler, setDersler] = useState([]);
  const [selectedDersId, setSelectedDersId] = useState(null);
  const [konular, setKonular] = useState([]);
  const [selectedKonuId, setSelectedKonuId] = useState(null);
  const [sorular, setSorular] = useState([]);
  const [query, setQuery] = useState("");
  const [aiStatus, setAiStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingSoruId, setEditingSoruId] = useState(null);
  const [form, setForm] = useState({
    metin: "",
    aciklama: "",
    zorluk: "1",
    soruNo: "",
  });
  const [options, setOptions] = useState([
    { id: null, text: "", correct: false, order: 1 },
    { id: null, text: "", correct: false, order: 2 },
    { id: null, text: "", correct: false, order: 3 },
    { id: null, text: "", correct: false, order: 4 },
    { id: null, text: "", correct: false, order: 5 },
  ]);
  const [existingSecenekler, setExistingSecenekler] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dersler, denemeler, raporlar] = await Promise.all([fetchDersler(), fetchDenemeSinavlari(), fetchRaporlar(200)]);
      let konuCount = 0;
      let soruCount = 0;
      for (const d of dersler || []) {
        const konular = await fetchKonular(d.id);
        konuCount += (Array.isArray(konular) ? konular.length : 0);
        const sorular = await fetchSorular({ dersId: d.id });
        soruCount += (Array.isArray(sorular) ? sorular.length : 0);
      }
      setDersler(Array.isArray(dersler) ? dersler : []);
      if (!selectedDersId && dersler?.[0]?.id) setSelectedDersId(dersler[0].id);
      setStats({
        ders: Array.isArray(dersler) ? dersler.length : 0,
        konu: konuCount,
        soru: soruCount,
        deneme: Array.isArray(denemeler) ? denemeler.length : 0,
        rapor: Array.isArray(raporlar) ? raporlar.length : 0,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDersId]);

  const loadDersData = useCallback(async () => {
    if (!selectedDersId) return;
    try {
      const [k, s] = await Promise.all([fetchKonular(selectedDersId), fetchSorular({ dersId: selectedDersId, konuId: selectedKonuId || undefined })]);
      setKonular(Array.isArray(k) ? k : []);
      setSorular(Array.isArray(s) ? s : []);
    } catch {
      setKonular([]);
      setSorular([]);
    }
  }, [selectedDersId, selectedKonuId]);

  const loadAiStatus = useCallback(async () => {
    try {
      const data = await fetchAiWeakTopics({ days: 30, limit: 1 });
      const top = Array.isArray(data?.weakTopics) && data.weakTopics[0] ? data.weakTopics[0] : null;
      setAiStatus(top ? { source: top.source || "heuristic", modelVersion: top.modelVersion || null } : null);
    } catch {
      setAiStatus(null);
    }
  }, []);

  function resetForm() {
    setEditingSoruId(null);
    setForm({ metin: "", aciklama: "", zorluk: "1", soruNo: "" });
    setOptions([
      { id: null, text: "", correct: false, order: 1 },
      { id: null, text: "", correct: false, order: 2 },
      { id: null, text: "", correct: false, order: 3 },
      { id: null, text: "", correct: false, order: 4 },
      { id: null, text: "", correct: false, order: 5 },
    ]);
    setExistingSecenekler([]);
  }

  function normalizeSecenekler(list) {
    const sorted = [...(Array.isArray(list) ? list : [])].sort((a, b) => Number(a?.siralama || 0) - Number(b?.siralama || 0));
    const normalized = sorted.map((s, idx) => ({
      id: s?.id || null,
      text: s?.metin || "",
      correct: s?.dogru === true || s?.dogru === 1,
      order: Number(s?.siralama || idx + 1),
    }));
    while (normalized.length < 5) normalized.push({ id: null, text: "", correct: false, order: normalized.length + 1 });
    return normalized.slice(0, 5);
  }

  async function startEditSoru(soru) {
    // Kullaniciya aninda geri bildirim ver: form hemen duzenleme moduna gecsin.
    setEditingSoruId(soru?.id || null);
    setForm({
      metin: soru?.metin || "",
      aciklama: soru?.aciklama || "",
      zorluk: String(soru?.zorluk || 1),
      soruNo: soru?.soruNo ? String(soru.soruNo) : "",
    });
    const prefillSecenekler = normalizeSecenekler(soru?.secenekler || []);
    setOptions(prefillSecenekler);
    setExistingSecenekler(Array.isArray(soru?.secenekler) ? soru.secenekler : []);
    if (!selectedKonuId) {
      const firstKonuId = Array.isArray(soru?.konular) && soru.konular[0]?.id ? soru.konular[0].id : null;
      if (firstKonuId) setSelectedKonuId(firstKonuId);
    }
    requestAnimationFrame(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }));

    try {
      const detail = await fetchSoruDetay(soru.id);
      const secenekler = Array.isArray(detail?.secenekler) ? detail.secenekler : [];
      setEditingSoruId(soru.id);
      setForm({
        metin: detail?.metin || "",
        aciklama: detail?.aciklama || "",
        zorluk: String(detail?.zorluk || 1),
        soruNo: detail?.soruNo ? String(detail.soruNo) : "",
      });
      setOptions(normalizeSecenekler(secenekler));
      setExistingSecenekler(secenekler);
      if (!selectedKonuId) {
        const firstKonuId = Array.isArray(detail?.konular) && detail.konular[0]?.id ? detail.konular[0].id : null;
        if (firstKonuId) setSelectedKonuId(firstKonuId);
      }
    } catch (e) {
      // Detay endpoint'i patlasa bile duzenleme acik kalir (prefill ile).
      const detailErr = e?.response?.data?.message || e?.response?.data?.error;
      if (detailErr) {
        Alert.alert("Uyari", `Detay endpoint hatasi: ${detailErr}\nTemel veri ile duzenlemeye devam edebilirsin.`);
      }
    }
  }

  async function onDeleteSoru(soruId) {
    Alert.alert("Soru Sil", "Bu soruyu silmek istiyor musun?", [
      { text: "Iptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await removeSoru(soruId);
            await loadDersData();
            if (editingSoruId === soruId) resetForm();
          } catch (e) {
            Alert.alert("Hata", e?.response?.data?.message || "Soru silinemedi.");
          }
        },
      },
    ]);
  }

  function setOptionText(index, value) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text: value } : o)));
  }

  function setCorrectOption(index) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, correct: i === index })));
  }

  async function onSaveSoru() {
    if (!selectedDersId) {
      Alert.alert("Hata", "Ders secmelisin.");
      return;
    }
    if (!form.metin.trim()) {
      Alert.alert("Hata", "Soru metni zorunlu.");
      return;
    }
    const filled = options
      .map((o, idx) => ({ ...o, text: String(o.text || "").trim(), order: idx + 1 }))
      .filter((o) => o.text.length > 0);
    if (filled.length < 2) {
      Alert.alert("Hata", "En az 2 secenek girmelisin.");
      return;
    }
    if (!filled.some((o) => o.correct)) {
      Alert.alert("Hata", "Bir dogru secenek secmelisin.");
      return;
    }
    setSaving(true);
    try {
      if (editingSoruId) {
        await updateSoru(editingSoruId, {
          metin: form.metin.trim(),
          tip: "coktan_secmeli",
          zorluk: Number(form.zorluk || 1),
          aciklama: form.aciklama || null,
          soruNo: form.soruNo ? Number(form.soruNo) : null,
          konuIds: selectedKonuId ? [Number(selectedKonuId)] : [],
          secenekler: filled.map((o) => ({
            id: o.id || null,
            metin: o.text,
            dogru: !!o.correct,
            siralama: Number(o.order),
          })),
        });

        for (const existing of existingSecenekler) {
          const stillExists = filled.some((o) => o.id && Number(o.id) === Number(existing.id));
          if (!stillExists && existing?.id) {
            try {
              await removeSecenek(existing.id);
            } catch {
              // ignore individual remove failures
            }
          }
        }
        for (const opt of filled) {
          if (opt.id) {
            await updateSecenek(opt.id, { metin: opt.text, dogru: !!opt.correct, siralama: Number(opt.order) });
          } else {
            await createSecenek(editingSoruId, { metin: opt.text, dogru: !!opt.correct, siralama: Number(opt.order) });
          }
        }
      } else {
        const created = await createSoru({
          dersId: Number(selectedDersId),
          konuIds: selectedKonuId ? [Number(selectedKonuId)] : [],
          metin: form.metin.trim(),
          tip: "coktan_secmeli",
          zorluk: Number(form.zorluk || 1),
          aciklama: form.aciklama || null,
          soruNo: form.soruNo ? Number(form.soruNo) : null,
        });
        for (const opt of filled) {
          await createSecenek(created.id, { metin: opt.text, dogru: !!opt.correct, siralama: Number(opt.order) });
        }
      }
      await loadDersData();
      resetForm();
      Alert.alert("Basarili", editingSoruId ? "Soru guncellendi." : "Soru eklendi.");
    } catch (e) {
      Alert.alert("Hata", e?.response?.data?.message || e?.response?.data?.error || "Soru kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
      loadAiStatus();
    }, [load, loadAiStatus])
  );

  useFocusEffect(
    useCallback(() => {
      loadDersData();
    }, [loadDersData])
  );

  const filteredSorular = useMemo(() => {
    const q = String(query || "").toLocaleLowerCase("tr-TR").trim();
    if (!q) return sorular;
    return sorular.filter((s) => {
      const metin = String(s?.metin || "").toLocaleLowerCase("tr-TR");
      const aciklama = String(s?.aciklama || "").toLocaleLowerCase("tr-TR");
      return metin.includes(q) || aciklama.includes(q);
    });
  }, [sorular, query]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Admin Panel" subtitle="Webdeki admin akisinin mobil ozeti" />
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 20 }}>
        <Card style={styles.card}>
          <Text style={styles.h2}>AI Motor Durumu</Text>
          <Text style={styles.meta}>
            Aktif kaynak: {aiStatus?.source || "heuristic"}
            {aiStatus?.modelVersion ? ` (${aiStatus.modelVersion})` : ""}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Sistem Ozeti</Text>
          <View style={styles.grid}>
            <View style={styles.pill}><Text style={styles.v}>{stats.ders}</Text><Text style={styles.l}>Ders</Text></View>
            <View style={styles.pill}><Text style={styles.v}>{stats.konu}</Text><Text style={styles.l}>Konu</Text></View>
            <View style={styles.pill}><Text style={styles.v}>{stats.soru}</Text><Text style={styles.l}>Soru</Text></View>
            <View style={styles.pill}><Text style={styles.v}>{stats.deneme}</Text><Text style={styles.l}>Deneme</Text></View>
            <View style={styles.pill}><Text style={styles.v}>{stats.rapor}</Text><Text style={styles.l}>Rapor</Text></View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Hizli Islem</Text>
          <View style={styles.row}>
            <PrimaryButton title="Derslerim" style={{ flex: 1 }} onPress={() => navigation.navigate("MainTabs", { screen: "HomeTab" })} />
            <PrimaryButton title="Soru Coz" style={{ flex: 1 }} onPress={() => navigation.navigate("Quiz", { ders: { id: 1, ad: "Matematik" } })} />
          </View>
          <View style={styles.row}>
            <SecondaryButton title="Denemeler" style={{ flex: 1 }} onPress={() => navigation.navigate("MainTabs", { screen: "DenemeTab" })} />
            <SecondaryButton title="Raporlar" style={{ flex: 1 }} onPress={() => navigation.navigate("MainTabs", { screen: "ReportsTab" })} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Ders / Konu Secimi</Text>
          <View style={styles.wrap}>
            {dersler.map((d) => (
              <Pressable key={String(d.id)} style={[styles.chip, selectedDersId === d.id && styles.chipActive]} onPress={() => { setSelectedDersId(d.id); setSelectedKonuId(null); }}>
                <Text style={[styles.chipText, selectedDersId === d.id && styles.chipTextActive]}>{d.ad}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.wrap, { marginTop: 8 }]}>
            <Pressable style={[styles.chip, !selectedKonuId && styles.chipActive]} onPress={() => setSelectedKonuId(null)}>
              <Text style={[styles.chipText, !selectedKonuId && styles.chipTextActive]}>Tum Konular</Text>
            </Pressable>
            {konular.map((k) => (
              <Pressable key={String(k.id)} style={[styles.chip, selectedKonuId === k.id && styles.chipActive]} onPress={() => setSelectedKonuId(k.id)}>
                <Text style={[styles.chipText, selectedKonuId === k.id && styles.chipTextActive]}>{k.ad}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>{editingSoruId ? "Soru Duzenle" : "Yeni Soru Ekle"}</Text>
          <TextInput style={styles.input} placeholder="Soru metni" value={form.metin} onChangeText={(v) => setForm((s) => ({ ...s, metin: v }))} />
          <TextInput style={styles.input} placeholder="Aciklama (opsiyonel)" value={form.aciklama} onChangeText={(v) => setForm((s) => ({ ...s, aciklama: v }))} />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Zorluk (1-5)"
              keyboardType="number-pad"
              value={form.zorluk}
              onChangeText={(v) => setForm((s) => ({ ...s, zorluk: v }))}
            />
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Soru No"
              keyboardType="number-pad"
              value={form.soruNo}
              onChangeText={(v) => setForm((s) => ({ ...s, soruNo: v }))}
            />
          </View>
          <Text style={[styles.meta, { marginTop: 8 }]}>Secenekler</Text>
          {options.map((o, idx) => (
            <View key={`opt-${idx}`} style={styles.optionRow}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder={`Secenek ${idx + 1}`} value={o.text} onChangeText={(v) => setOptionText(idx, v)} />
              <Pressable style={[styles.correctChip, o.correct && styles.correctChipActive]} onPress={() => setCorrectOption(idx)}>
                <Text style={[styles.correctText, o.correct && styles.correctTextActive]}>{o.correct ? "Dogru" : "Sec"}</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.row}>
            <PrimaryButton title={saving ? "Kaydediliyor..." : editingSoruId ? "Guncelle" : "Soru Ekle"} style={{ flex: 1 }} onPress={onSaveSoru} disabled={saving} />
            <SecondaryButton title="Temizle" style={{ flex: 1 }} onPress={resetForm} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Sorular</Text>
          <TextInput style={styles.input} placeholder="Soru metni/Aciklama ara..." value={query} onChangeText={setQuery} />
          <Text style={styles.meta}>Liste: {filteredSorular.length} soru</Text>
          {filteredSorular.slice(0, 120).map((s, idx) => (
            <View key={String(s.id || idx)} style={styles.qRow}>
              <Text style={styles.qTitle}>#{idx + 1} {s?.metin || "-"}</Text>
              <Text style={styles.qMeta}>{s?.aciklama || "Aciklama yok"}</Text>
              <View style={styles.row}>
                <PrimaryButton title="Duzenle" style={{ flex: 1 }} onPress={() => startEditSoru(s)} />
                <SecondaryButton title="Sil" style={{ flex: 1 }} onPress={() => onDeleteSoru(s.id)} />
              </View>
            </View>
          ))}
        </Card>

        <PrimaryButton title="Verileri Yenile" onPress={load} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { marginBottom: 10 },
  h2: { color: colors.text, fontWeight: "800", marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { width: "31%", minWidth: 90, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: "#fff" },
  v: { color: colors.primary, fontWeight: "800", fontSize: 18 },
  l: { color: colors.muted, fontSize: 11, marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  wrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.primary },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  meta: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  correctChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: "#fff", minWidth: 62, alignItems: "center" },
  correctChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  correctText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  correctTextActive: { color: colors.primary },
  qRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  qTitle: { color: colors.text, fontWeight: "700" },
  qMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
