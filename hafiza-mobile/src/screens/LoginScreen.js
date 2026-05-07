import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { PrimaryButton } from "../components/ui";
import { getApiBaseUrl } from "../services/apiBaseUrl";
import { colors } from "../theme";

const SINIF_OPTIONS = [
  { value: "9", label: "9" },
  { value: "10", label: "10" },
  { value: "11", label: "11" },
  { value: "12", label: "12" },
];

export default function LoginScreen() {
  const { login, register, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [sinif, setSinif] = useState("");

  async function onSubmit() {
    if (!email?.trim() || !password) {
      Alert.alert("Eksik bilgi", "E-posta ve şifre zorunludur.");
      return;
    }
    if (isRegister) {
      if (!ad?.trim() || !soyad?.trim()) {
        Alert.alert("Eksik bilgi", "Kayıt için ad ve soyad zorunludur.");
        return;
      }
      if (!sinif) {
        Alert.alert("Eksik bilgi", "Sınıf seçin.");
        return;
      }
    }

    try {
      if (isRegister) {
        await register({
          email: email.trim(),
          password,
          ad: ad.trim(),
          soyad: soyad.trim(),
          sinif: sinif || null,
        });
        Alert.alert("Başarılı", "Kayıt tamamlandı. Şimdi giriş yapabilirsiniz.");
        setIsRegister(false);
        setPassword("");
        setAd("");
        setSoyad("");
        setSinif("");
      } else {
        await login(email.trim(), password);
      }
    } catch (e) {
      const isNetwork =
        e?.code === "ECONNABORTED" ||
        e?.code === "ERR_NETWORK" ||
        e?.message === "Network Error" ||
        (!e?.response && e?.request);
      const base = getApiBaseUrl();
      const errMsg = isNetwork
        ? `Sunucuya ulaşılamadı.\n\nDenenen adres:\n${base}\n\nAğ ve backend adresini kontrol edin.`
        : e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "İşlem başarısız.";
      Alert.alert("Hata", String(errMsg));
    }
  }

  function switchMode(register) {
    setIsRegister(register);
    if (!register) {
      setAd("");
      setSoyad("");
      setSinif("");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <View style={styles.heroOrb1} />
            <View style={styles.heroOrb2} />
            <Text style={styles.heroEmoji}>📚</Text>
            <Text style={styles.heroTitle}>Hafıza Akademi</Text>
            <Text style={styles.heroLead}>YKS hazırlığında sorular, videolar ve raporlar tek yerde.</Text>
          </View>

          <View style={styles.cardWrap}>
            <View style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.segment}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: !isRegister }}
                  onPress={() => switchMode(false)}
                  style={[styles.segmentBtn, !isRegister && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, !isRegister && styles.segmentTextActive]}>Giriş yap</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isRegister }}
                  onPress={() => switchMode(true)}
                  style={[styles.segmentBtn, isRegister && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, isRegister && styles.segmentTextActive]}>Kayıt ol</Text>
                </Pressable>
              </View>

              <Text style={styles.cardHint}>
                {isRegister ? "Bilgilerini gir; hesabın birkaç saniyede hazır." : "Hesabına giriş yap ve devam et."}
              </Text>

              <View style={styles.field}>
                <Text style={styles.label}>E-posta</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ornek@email.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                />
              </View>

              {isRegister ? (
                <>
                  <View style={styles.row2}>
                    <View style={[styles.field, styles.flex1]}>
                      <Text style={styles.label}>Ad</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Adın"
                        placeholderTextColor={colors.muted}
                        value={ad}
                        onChangeText={setAd}
                        autoComplete="given-name"
                        textContentType="givenName"
                        editable={!loading}
                      />
                    </View>
                    <View style={[styles.field, styles.flex1]}>
                      <Text style={styles.label}>Soyad</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Soyadın"
                        placeholderTextColor={colors.muted}
                        value={soyad}
                        onChangeText={setSoyad}
                        autoComplete="family-name"
                        textContentType="familyName"
                        editable={!loading}
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Sınıf</Text>
                    <View style={styles.sinifRow}>
                      {SINIF_OPTIONS.map((o) => (
                        <Pressable
                          key={o.value}
                          onPress={() => setSinif(o.value)}
                          style={[styles.sinifChip, sinif === o.value && styles.sinifChipActive]}
                          disabled={loading}
                        >
                          <Text style={[styles.sinifChipText, sinif === o.value && styles.sinifChipTextActive]}>{o.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>Şifre</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    autoComplete={isRegister ? "password-new" : "password"}
                    textContentType={isRegister ? "newPassword" : "password"}
                    editable={!loading}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁"}</Text>
                  </Pressable>
                </View>
              </View>

              <PrimaryButton title={isRegister ? "Kayıt ol" : "Giriş yap"} onPress={onSubmit} loading={loading} disabled={loading} />

              <Pressable
                style={styles.switchRow}
                onPress={() => switchMode(!isRegister)}
                disabled={loading}
              >
                <Text style={styles.switchText}>
                  {isRegister ? "Zaten hesabın var mı? " : "Hesabın yok mu? "}
                  <Text style={styles.switchBold}>{isRegister ? "Giriş yap" : "Kayıt ol"}</Text>
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.footerBlock}>
            <Text style={styles.footer}>© Hafıza Akademi</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Volkan Taşbent LinkedIn profili"
              onPress={() => Linking.openURL("https://www.linkedin.com/in/volkan-tasbent")}
            >
              <Text style={styles.footerCredit}>Created by Volkan Taşbent</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f1117" },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  hero: {
    paddingTop: 12,
    paddingBottom: 56,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  heroOrb1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.12)",
    top: -90,
    right: -70,
  },
  heroOrb2: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)",
    bottom: -40,
    left: -50,
  },
  heroEmoji: {
    fontSize: 40,
    marginBottom: 10,
    zIndex: 1,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    textAlign: "center",
    zIndex: 1,
  },
  heroLead: {
    marginTop: 10,
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
    fontWeight: "600",
    zIndex: 1,
  },
  cardWrap: {
    marginTop: -36,
    paddingHorizontal: 16,
    zIndex: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 5,
    gap: 6,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  cardHint: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 18,
    lineHeight: 20,
  },
  field: { marginBottom: 16 },
  flex1: { flex: 1, minWidth: 0 },
  row2: { flexDirection: "row", gap: 12 },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingRight: 6,
  },
  inputFlex: {
    flex: 1,
    borderWidth: 0,
    minHeight: 48,
    backgroundColor: "transparent",
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeText: {
    fontSize: 20,
  },
  sinifRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sinifChip: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sinifChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  sinifChipText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.muted,
  },
  sinifChipTextActive: {
    color: colors.primary,
  },
  switchRow: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
  },
  switchBold: {
    fontWeight: "800",
    color: colors.primary,
  },
  footerBlock: {
    alignItems: "center",
    marginTop: 28,
    gap: 6,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
  },
  footerCredit: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,255,255,0.35)",
  },
});
