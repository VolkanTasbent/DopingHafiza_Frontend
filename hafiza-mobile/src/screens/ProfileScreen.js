import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { fetchProfile, updateProfile, uploadAvatar } from "../services/quiz";
import { Card, PrimaryButton, SectionTitle } from "../components/ui";
import { colors } from "../theme";

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    ad: "",
    soyad: "",
    email: "",
    hedefUniversite: "",
    hedefBolum: "",
    hedefSiralama: "10000",
  });
  const [initialForm, setInitialForm] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      const data = await fetchProfile();
      setUser(data);
      setForm({
        ad: data?.ad || "",
        soyad: data?.soyad || "",
        email: data?.email || "",
        hedefUniversite: data?.hedefUniversite || data?.hedef_universite || "",
        hedefBolum: data?.hedefBolum || data?.hedef_bolum || "",
        hedefSiralama: String(data?.hedefSiralama || data?.hedef_siralama || 10000),
      });
      setInitialForm({
        ad: data?.ad || "",
        soyad: data?.soyad || "",
        email: data?.email || "",
        hedefUniversite: data?.hedefUniversite || data?.hedef_universite || "",
        hedefBolum: data?.hedefBolum || data?.hedef_bolum || "",
        hedefSiralama: String(data?.hedefSiralama || data?.hedef_siralama || 10000),
      });
    } catch {
      Alert.alert("Hata", "Profil bilgileri alinamadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  async function onSave() {
    if (!user) return;
    if (!String(form.email).includes("@")) {
      Alert.alert("Hata", "Gecerli bir e-posta gir.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...user,
        ad: form.ad,
        soyad: form.soyad,
        email: form.email,
        hedefUniversite: form.hedefUniversite,
        hedefBolum: form.hedefBolum,
        hedefSiralama: Number(form.hedefSiralama || 10000),
      };
      const updated = await updateProfile(payload);
      setUser(updated || payload);
      Alert.alert("Basarili", "Profil guncellendi.");
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || "Profil guncellenemedi.";
      Alert.alert("Hata", String(msg));
    } finally {
      setSaving(false);
    }
  }

  function toAbsoluteUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    const base = String(process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
    if (!base) return raw;
    return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
  }

  async function pickAndUploadAvatar(mode = "gallery") {
    try {
      const permission =
        mode === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert("Izin Gerekli", mode === "camera" ? "Kamera izni vermelisin." : "Galeri izni vermelisin.");
        return;
      }
      const result =
        mode === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.85,
              aspect: [1, 1],
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.85,
              aspect: [1, 1],
            });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const size = Number(asset.fileSize || 0);
      if (size > 5 * 1024 * 1024) {
        Alert.alert("Hata", "Resim boyutu 5MB'dan kucuk olmalidir.");
        return;
      }
      setUploadingAvatar(true);
      const updated = await uploadAvatar(asset);
      setUser(updated || user);
      Alert.alert("Basarili", "Profil resmi guncellendi.");
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.response?.data || e?.message || "Profil resmi yuklenemedi.";
      Alert.alert("Hata", String(msg));
    } finally {
      setUploadingAvatar(false);
    }
  }

  function onPickAvatar() {
    Alert.alert("Profil Fotografi", "Resmi nereden yuklemek istersin?", [
      { text: "Iptal", style: "cancel" },
      { text: "Kamera", onPress: () => pickAndUploadAvatar("camera") },
      { text: "Galeri", onPress: () => pickAndUploadAvatar("gallery") },
    ]);
  }

  const initials = `${form.ad?.[0] || ""}${form.soyad?.[0] || ""}`.toUpperCase() || "U";
  const avatarUrl = toAbsoluteUrl(user?.avatar_url || user?.avatarUrl || user?.avatar || "");
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <Card style={styles.topBar}>
          <Pressable onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation.navigate("MainTabs", { screen: "HomeTab" }))}>
            <Text style={styles.backText}>← Geri</Text>
          </Pressable>
        </Card>
        <SectionTitle title="Profilim" subtitle="Bilgilerini ve hedeflerini guncelle" />
        <Card style={styles.avatarCard}>
          <Pressable style={styles.avatar} onPress={onPickAvatar} disabled={uploadingAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
            <View style={styles.cameraBadge}>
              <Text style={styles.cameraBadgeText}>{uploadingAvatar ? "..." : "📷"}</Text>
            </View>
          </Pressable>
          <Text style={styles.userName}>{form.ad} {form.soyad}</Text>
          <Text style={styles.userMail}>{form.email}</Text>
          <Text style={styles.avatarHint}>Profil resmini degistirmek icin dokun</Text>
        </Card>

        <Card style={{ marginBottom: 10 }}>
          <Text style={styles.blockTitle}>Kisisel Bilgiler</Text>
          <TextInput style={styles.input} placeholder="Ad" value={form.ad} onChangeText={(v) => setForm((s) => ({ ...s, ad: v }))} />
          <TextInput style={styles.input} placeholder="Soyad" value={form.soyad} onChangeText={(v) => setForm((s) => ({ ...s, soyad: v }))} />
          <TextInput
            style={styles.input}
            placeholder="E-posta"
            autoCapitalize="none"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(v) => setForm((s) => ({ ...s, email: v }))}
          />
        </Card>

        <Card style={{ marginBottom: 10 }}>
          <Text style={styles.blockTitle}>Hedefler</Text>
          <TextInput
            style={styles.input}
            placeholder="Hedef Universite"
            value={form.hedefUniversite}
            onChangeText={(v) => setForm((s) => ({ ...s, hedefUniversite: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Hedef Bolum"
            value={form.hedefBolum}
            onChangeText={(v) => setForm((s) => ({ ...s, hedefBolum: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Hedef Siralama"
            keyboardType="number-pad"
            value={form.hedefSiralama}
            onChangeText={(v) => setForm((s) => ({ ...s, hedefSiralama: v }))}
          />
        </Card>

        <Card style={styles.metaBox}>
          <Text style={styles.meta}>Sinif: {user?.sinif ? `${user.sinif}. Sinif` : "-"}</Text>
          <Text style={styles.meta}>Rol: {user?.role || "-"}</Text>
        </Card>
        <PrimaryButton
          title={saving ? "Kaydediliyor..." : isDirty ? "Kaydet" : "Degisiklik Yok"}
          onPress={onSave}
          disabled={saving || !isDirty}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { marginBottom: 8, paddingVertical: 10 },
  backText: { color: colors.primary, fontWeight: "800" },
  avatarCard: { alignItems: "center", marginBottom: 10 },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    overflow: "hidden",
    position: "relative",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontSize: 28, fontWeight: "800", color: colors.primary },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadgeText: { color: "#fff", fontSize: 12 },
  avatarHint: { color: colors.muted, fontSize: 11, marginTop: 4 },
  userName: { fontSize: 18, fontWeight: "800", color: colors.text },
  userMail: { color: colors.muted, marginTop: 2 },
  blockTitle: { fontWeight: "700", marginBottom: 8, color: colors.text },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 10 },
  metaBox: { marginBottom: 12 },
  meta: { color: "#4b5563", marginBottom: 2 },
});
