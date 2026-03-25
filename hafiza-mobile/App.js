import { StatusBar } from "expo-status-bar";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { UiPrefsProvider, useUiPrefs } from "./src/context/UiPrefsContext";
import RootNavigator from "./src/navigation/RootNavigator";

function AppShell() {
  const { darkMode } = useUiPrefs();
  const navTheme = darkMode
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: "#0f172a",
          card: "#111827",
          text: "#f8fafc",
          border: "#334155",
          primary: "#818cf8",
        },
      }
    : DefaultTheme;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UiPrefsProvider>
          <AppShell />
        </UiPrefsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
