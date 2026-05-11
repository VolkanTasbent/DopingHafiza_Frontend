import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { radius, shadow } from "../theme";

function useUiStyles() {
  const { colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
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
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#667eea",
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
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
        secondaryOutlineLight: {
          backgroundColor: colors.card,
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.border,
        },
        secondaryOutlineDark: {
          backgroundColor: "transparent",
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.42)",
        },
        secondaryOutlineTextLight: { color: colors.text, fontWeight: "600", fontSize: 15 },
        secondaryOutlineTextDark: { color: "#e2e8f0", fontWeight: "600", fontSize: 15 },
        secondaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
        disabled: { opacity: 0.5 },
        progressBg: {
          width: "100%",
          backgroundColor: colors.border,
          borderRadius: 999,
          overflow: "hidden",
        },
        progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 999 },
      }),
    [colors]
  );
}

export function Card({ children, style }) {
  const styles = useUiStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, subtitle }) {
  const styles = useUiStyles();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, loading, style }) {
  const styles = useUiStyles();
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={[styles.primaryBtn, disabled && styles.disabled, style]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled, style, variant = "filled", dark }) {
  const styles = useUiStyles();
  const outline = variant === "outline";
  const outlineStyle = outline ? (dark ? styles.secondaryOutlineDark : styles.secondaryOutlineLight) : styles.secondaryBtn;
  const textStyle = outline ? (dark ? styles.secondaryOutlineTextDark : styles.secondaryOutlineTextLight) : styles.secondaryText;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[outlineStyle, disabled && styles.disabled, style]}>
      <Text style={textStyle}>{title}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value = 0, height = 10 }) {
  const styles = useUiStyles();
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.progressBg, { height }]}>
      <View style={[styles.progressFill, { width: `${safeValue}%` }]} />
    </View>
  );
}
