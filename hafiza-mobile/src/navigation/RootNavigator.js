import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import QuizScreen from "../screens/QuizScreen";
import BadgesScreen from "../screens/BadgesScreen";
import InsightsScreen from "../screens/InsightsScreen";
import TasksScreen from "../screens/TasksScreen";
import FocusTimerScreen from "../screens/FocusTimerScreen";
import FlashcardsScreen from "../screens/FlashcardsScreen";
import CalendarScreen from "../screens/CalendarScreen";
import SearchScreen from "../screens/SearchScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import VideoLessonsScreen from "../screens/VideoLessonsScreen";
import ReportDetailScreen from "../screens/ReportDetailScreen";
import CourseDetailScreen from "../screens/CourseDetailScreen";
import QuestionSolutionScreen from "../screens/QuestionSolutionScreen";
import AiCoachScreen from "../screens/AiCoachScreen";
import CalismaProgramiScreen from "../screens/CalismaProgramiScreen";
import StudyPlanScreen from "../screens/StudyPlanScreen";
import MainTabs from "./MainTabs";
import { colors } from "../theme";
import { useUiPrefs } from "../context/UiPrefsContext";

const Stack = createNativeStackNavigator();

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, tokenChecked } = useAuth();
  const { darkMode } = useUiPrefs();

  if (!tokenChecked) return <Splash />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: darkMode ? "#111827" : colors.card },
        headerTitleStyle: { fontWeight: "800", color: darkMode ? "#f8fafc" : colors.text },
        headerTintColor: darkMode ? "#f8fafc" : colors.text,
        headerBackTitle: "Geri",
        headerBackTitleVisible: true,
        contentStyle: { backgroundColor: darkMode ? "#0f172a" : colors.bg },
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Quiz" component={QuizScreen} options={{ title: "Soru Coz" }} />
          <Stack.Screen name="CourseDetail" component={CourseDetailScreen} options={{ title: "Ders Detay" }} />
          <Stack.Screen name="Badges" component={BadgesScreen} options={{ title: "Rozetlerim" }} />
          <Stack.Screen name="Insights" component={InsightsScreen} options={{ title: "Grafiklerim" }} />
          <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: "Gorevler" }} />
          <Stack.Screen name="FocusTimer" component={FocusTimerScreen} options={{ title: "Pomodoro" }} />
          <Stack.Screen name="Flashcards" component={FlashcardsScreen} options={{ title: "Flashcard" }} />
          <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: "Takvim" }} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Arama" }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Bildirimler" }} />
          <Stack.Screen name="VideoLessons" component={VideoLessonsScreen} options={{ title: "Konu Videolari" }} />
          <Stack.Screen name="ReportDetail" component={ReportDetailScreen} options={{ title: "Rapor Detay" }} />
          <Stack.Screen name="QuestionSolution" component={QuestionSolutionScreen} options={{ title: "Soru Cozumu" }} />
          <Stack.Screen name="AiCoach" component={AiCoachScreen} options={{ title: "AI Ders Kocu" }} />
          <Stack.Screen name="CalismaProgrami" component={CalismaProgramiScreen} options={{ title: "Calisma programi" }} />
          <Stack.Screen name="StudyPlan" component={StudyPlanScreen} options={{ title: "Haftalik plan" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
