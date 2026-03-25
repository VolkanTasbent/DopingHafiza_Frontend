import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "../theme";

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, subtitle }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, loading, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={[styles.primaryBtn, disabled && styles.disabled, style]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.secondaryBtn, disabled && styles.disabled, style]}>
      <Text style={styles.secondaryText}>{title}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value = 0, height = 10 }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.progressBg, { height }]}>
      <View style={[styles.progressFill, { width: `${safeValue}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  title: { fontSize: 23, fontWeight: "800", color: colors.text, letterSpacing: 0.2 },
  subtitle: { color: colors.muted, marginTop: 4, fontWeight: "500" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12.5,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: colors.dark,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.5 },
  progressBg: { width: "100%", backgroundColor: "#e2e8f0", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 999 },
});
