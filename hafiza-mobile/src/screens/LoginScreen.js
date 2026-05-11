import { useMemo, useState } from "react";
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
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../context/AuthContext";
import { PrimaryButton, SecondaryButton } from "../components/ui";
import { getApiBaseUrl } from "../services/apiBaseUrl";
import { useTheme } from "../context/ThemeContext";

const SINIF_OPTIONS = [
  { value: "9", label: "9" },
  { value: "10", label: "10" },
  { value: "11", label: "11" },
  { value: "12", label: "12" },
];

function formatAuthError(e) {
  const isNetwork =
    e?.code === "ECONNABORTED" ||
    e?.code === "ERR_NETWORK" ||
    e?.message === "Network Error" ||
    (!e?.response && e?.request);
  const base = getApiBaseUrl();
  if (isNetwork) {
    return `Sunucuya ulaşılamadı.\n\nDenenen adres:\n${base}\n\nİnternet ve API adresini kontrol edin.`;
  }
  let payload = e?.response?.data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return payload || e?.message || "İşlem başarısız.";
    }
  }
  if (payload && typeof payload === "object") {
    const t = payload.type || payload.error;
    if (t === "BadCredentialsException" || payload.error === "Bad credentials") {
      return "E-posta veya şifre hatalı.";
    }
    if (t === "UsernameNotFoundException") {
      return payload.message || "Bu e-posta ile kayıt bulunamadı.";
    }
    return payload.message || payload.error || payload.detail || "İşlem başarısız.";
  }
  return e?.message || "İşlem başarısız.";
}

const HERO_BG = "#0a0b12";

function createLoginStyles(c) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: HERO_BG },
    flex: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: 28,
    },
    hero: {
      paddingTop: 8,
      paddingBottom: 52,
      paddingHorizontal: 22,
      backgroundColor: HERO_BG,
      alignItems: "center",
      overflow: "hidden",
      position: "relative",
    },
    heroGlow: {
      position: "absolute",
      width: 320,
      height: 280,
      borderRadius: 160,
      backgroundColor: "rgba(99, 102, 241, 0.22)",
      top: -120,
      alignSelf: "center",
    },
    heroGlow2: {
      position: "absolute",
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: "rgba(168, 85, 247, 0.12)",
      bottom: -40,
      right: -60,
    },
    heroBadge: {
      zIndex: 1,
      marginBottom: 12,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      overflow: "hidden",
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      color: "rgba(248,250,252,0.95)",
      backgroundColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      textAlign: "center",
    },
    heroEmoji: {
      fontSize: 36,
      marginBottom: 8,
      zIndex: 1,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: "#fafafa",
      letterSpacing: -0.4,
      textAlign: "center",
      lineHeight: 30,
      zIndex: 1,
      maxWidth: 400,
    },
    heroLead: {
      marginTop: 12,
      fontSize: 14,
      color: "rgba(203,213,225,0.95)",
      textAlign: "center",
      lineHeight: 21,
      maxWidth: 340,
      fontWeight: "500",
      zIndex: 1,
    },
    heroCtas: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 10,
      marginTop: 18,
      zIndex: 1,
      paddingHorizontal: 4,
    },
    heroOutlineBtn: {
      minWidth: 148,
      paddingVertical: 11,
      paddingHorizontal: 14,
      backgroundColor: "transparent",
      borderColor: "rgba(255,255,255,0.42)",
    },
    cardWrap: {
      marginTop: -32,
      paddingHorizontal: 16,
      zIndex: 2,
    },
    card: {
      backgroundColor: c.card,
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
      backgroundColor: c.surface,
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
      color: c.muted,
    },
    segmentTextActive: {
      color: c.primary,
    },
    cardHint: {
      fontSize: 14,
      color: c.muted,
      marginBottom: 18,
      lineHeight: 20,
    },
    field: { marginBottom: 16 },
    flex1: { flex: 1, minWidth: 0 },
    row2: { flexDirection: "row", gap: 12 },
    label: {
      fontSize: 13,
      fontWeight: "800",
      color: c.text,
      marginBottom: 8,
    },
    input: {
      minHeight: 50,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.surface,
    },
    passwordRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      backgroundColor: c.surface,
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
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    sinifChipActive: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    sinifChipText: {
      fontSize: 16,
      fontWeight: "800",
      color: c.muted,
    },
    sinifChipTextActive: {
      color: c.primary,
    },
    switchRow: {
      marginTop: 20,
      alignItems: "center",
      paddingVertical: 8,
    },
    switchText: {
      fontSize: 15,
      color: c.muted,
      textAlign: "center",
    },
    switchBold: {
      fontWeight: "800",
      color: c.primary,
    },
    footerBlock: {
      alignItems: "center",
      marginTop: 24,
      gap: 6,
      paddingBottom: 8,
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
}

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createLoginStyles(colors), [colors]);
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
      if (password.length < 6) {
        Alert.alert("Şifre", "Şifre en az 6 karakter olmalı.");
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
      Alert.alert("Hata", formatAuthError(e));
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
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <View style={styles.heroGlow} pointerEvents="none" />
            <View style={styles.heroGlow2} pointerEvents="none" />
            <Text style={styles.heroBadge}>YKS · soru · deneme · rapor</Text>
            <Text style={styles.heroEmoji}>📚</Text>
            <Text style={styles.heroTitle}>TYT ve AYT'ye hazırlanın; takip, grafik ve günlük görevler yanınızda.</Text>
            <Text style={styles.heroLead}>
              Soru çözümü, denemeler ve raporlar tek hesapta. Giriş yap veya ücretsiz kayıt ol.
            </Text>
            <View style={styles.heroCtas}>
              <SecondaryButton
                title="Ücretsiz kayıt ol"
                variant="outline"
                dark
                disabled={loading}
                style={styles.heroOutlineBtn}
                onPress={() => switchMode(true)}
              />
              <SecondaryButton
                title="Zaten hesabım var"
                variant="outline"
                dark
                disabled={loading}
                style={styles.heroOutlineBtn}
                onPress={() => switchMode(false)}
              />
            </View>
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

              <Pressable style={styles.switchRow} onPress={() => switchMode(!isRegister)} disabled={loading}>
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
