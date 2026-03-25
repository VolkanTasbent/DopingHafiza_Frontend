import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SectionTitle, SecondaryButton } from "../components/ui";
import { getJSON, setJSON } from "../services/storage";
import { colors } from "../theme";

export default function RemindersScreen() {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    (async () => {
      const data = await getJSON("reminders", []);
      setList(Array.isArray(data) ? data : []);
    })();
  }, []);

  useEffect(() => {
    setJSON("reminders", list);
  }, [list]);

  function addReminder() {
    const t = title.trim();
    if (!t) {
      Alert.alert("Eksik", "Hatirlatma metni gir.");
      return;
    }
    setList((prev) => [{ id: `r-${Date.now()}`, title: t, time: time.trim() || "--:--" }, ...prev]);
    setTitle("");
    setTime("");
  }

  function removeReminder(id) {
    setList((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Hatirlatmalar" subtitle="Calisma rutinini kacirmamak icin kendi hatirlatmalarini olustur" />
      <Card style={styles.card}>
        <TextInput style={styles.input} placeholder="Hatirlatma metni" value={title} onChangeText={setTitle} />
        <TextInput style={styles.input} placeholder="Saat (HH:MM)" value={time} onChangeText={setTime} />
        <PrimaryButton title="Hatirlatma Ekle" onPress={addReminder} />
      </Card>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {list.length === 0 ? (
          <Card style={styles.card}>
            <Text style={styles.empty}>Henuz hatirlatma yok.</Text>
          </Card>
        ) : (
          list.map((r) => (
            <Card key={r.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{r.title}</Text>
                <Text style={styles.itemTime}>Saat: {r.time}</Text>
              </View>
              <SecondaryButton title="Sil" onPress={() => removeReminder(r.id)} style={{ minWidth: 70 }} />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { marginBottom: 10 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  empty: { color: colors.muted, textAlign: "center" },
  item: { marginBottom: 8, flexDirection: "row", gap: 10, alignItems: "center" },
  itemTitle: { color: colors.text, fontWeight: "700" },
  itemTime: { color: colors.muted, marginTop: 2, fontSize: 12 },
});
