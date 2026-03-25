import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import DenemeScreen from "../screens/DenemeScreen";
import ReportsScreen from "../screens/ReportsScreen";
import GamificationScreen from "../screens/GamificationScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AdminScreen from "../screens/AdminScreen";
import { useAuth } from "../context/AuthContext";
import { useUiPrefs } from "../context/UiPrefsContext";
import { colors } from "../theme";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const { user } = useAuth();
  const { darkMode } = useUiPrefs();
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const iconMap = {
    HomeTab: "🏠",
    DenemeTab: "📝",
    ReportsTab: "📊",
    GameTab: "🏆",
    ProfileTab: "👤",
    AdminTab: "🛠",
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: darkMode ? "#111827" : colors.card },
        headerTitleStyle: { fontWeight: "800", color: darkMode ? "#f8fafc" : colors.text },
        headerTintColor: darkMode ? "#f8fafc" : colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: darkMode ? "#94a3b8" : colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800", paddingBottom: 2 },
        tabBarStyle: {
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopColor: darkMode ? "#334155" : colors.border,
          borderTopWidth: 1,
          backgroundColor: darkMode ? "#111827" : colors.card,
        },
        tabBarIcon: ({ color }) => <Text style={{ color, fontWeight: "800" }}>{iconMap[route.name] || "•"}</Text>,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: "Derslerim", tabBarLabel: "Dersler" }} />
      <Tab.Screen name="DenemeTab" component={DenemeScreen} options={{ title: "Deneme", tabBarLabel: "Deneme" }} />
      <Tab.Screen name="ReportsTab" component={ReportsScreen} options={{ title: "Raporlarim", tabBarLabel: "Raporlar" }} />
      <Tab.Screen name="GameTab" component={GamificationScreen} options={{ title: "Gamification", tabBarLabel: "Puan" }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: "Profil", tabBarLabel: "Profil" }} />
      {isAdmin ? <Tab.Screen name="AdminTab" component={AdminScreen} options={{ title: "Admin", tabBarLabel: "Admin" }} /> : null}
    </Tab.Navigator>
  );
}
