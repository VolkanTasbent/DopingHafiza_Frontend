import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { PrimaryButton } from "../components/ui";
import { colors } from "../theme";

export default function LoginScreen() {
  const { login, register, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [sinif, setSinif] = useState("");

  async function onSubmit() {
    if (!email || !password) {
      Alert.alert("Eksik bilgi", "E-posta ve sifre zorunlu.");
      return;
    }

    try {
      if (isRegister) {
        await register({
          email,
          password,
          ad,
          soyad,
          sinif: sinif || null,
        });
        Alert.alert("Basarili", "Kayit tamamlandi. Simdi giris yapabilirsiniz.");
        setIsRegister(false);
      } else {
        await login(email, password);
      }
    } catch (e) {
      const errMsg = e?.response?.data?.message || e?.response?.data?.error || "Islem basarisiz.";
      Alert.alert("Hata", String(errMsg));
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.hero}>
        <Text style={styles.badge}>Doping Tarzi Mobil Deneyim</Text>
        <Text style={styles.logo}>Hafiza Akademi</Text>
        <Text style={styles.heroSub}>YKS calismalarini hizli, modern ve tek yerden yonet.</Text>
        <View style={styles.heroList}>
          <Text style={styles.heroItem}>- Ders bazli test ve deneme cozumu</Text>
          <Text style={styles.heroItem}>- Video notlari, hedefler, hatirlatmalar</Text>
          <Text style={styles.heroItem}>- Rapor, seviye, rozet ve market sistemi</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.tabRow}>
          <Text style={[styles.tab, !isRegister && styles.tabActive]} onPress={() => setIsRegister(false)}>
            Giris Yap
          </Text>
          <Text style={[styles.tab, isRegister && styles.tabActive]} onPress={() => setIsRegister(true)}>
            Kayit Ol
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="E-posta"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {isRegister && (
          <>
            <TextInput style={styles.input} placeholder="Ad" value={ad} onChangeText={setAd} />
            <TextInput style={styles.input} placeholder="Soyad" value={soyad} onChangeText={setSoyad} />
            <TextInput style={styles.input} placeholder="Sinif (9-12)" value={sinif} onChangeText={setSinif} />
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Sifre"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <PrimaryButton title={isRegister ? "Kayit Ol" : "Giris Yap"} onPress={onSubmit} loading={loading} />
        {loading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: colors.bg },
  hero: { marginBottom: 16, alignItems: "center" },
  badge: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: "800",
    fontSize: 11,
    marginBottom: 8,
  },
  logo: { fontSize: 30, fontWeight: "800", color: colors.text },
  heroSub: { color: colors.muted, marginTop: 6, textAlign: "center" },
  heroList: {
    marginTop: 10,
    alignSelf: "stretch",
    backgroundColor: colors.surfaceStrong,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroItem: { color: colors.primaryDark, fontWeight: "700", marginBottom: 5, fontSize: 12.5 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  tabRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  tab: {
    flex: 1,
    textAlign: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.muted,
    fontWeight: "700",
  },
  tabActive: { backgroundColor: colors.primarySoft, color: colors.primary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.card },
});
