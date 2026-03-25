import { calculateDailyReward, calculateLevelFromXP, checkMilestones } from "./scoring";

export const BADGE_CATEGORIES = {
  xp: {
    name: "XP Rozetleri",
    badges: [
      { id: "xp_100", label: "Baslangic Ustasi", target: 100 },
      { id: "xp_500", label: "Deneyimli Ogrenci", target: 500 },
      { id: "xp_1500", label: "Efsane Ogrenci", target: 1500 },
      { id: "xp_5000", label: "Usta", target: 5000 },
    ],
  },
  daily: {
    name: "Gunluk Rozetler",
    badges: [
      { id: "daily_30", label: "Gunluk Hedef Ustasi", target: 30 },
      { id: "daily_50", label: "Super Gunluk", target: 50 },
      { id: "daily_100", label: "Efsane Gun", target: 100 },
    ],
  },
  accuracy: {
    name: "Dogruluk Rozetleri",
    badges: [
      { id: "acc_200", label: "Keskin Nisanci", target: 200 },
      { id: "acc_500", label: "Usta Nisanci", target: 500 },
      { id: "acc_1000", label: "Efsane Nisanci", target: 1000 },
    ],
  },
  streak: {
    name: "Seri Rozetleri",
    badges: [
      { id: "streak_3", label: "3 Gunluk Seri", target: 3 },
      { id: "streak_7", label: "7 Gunluk Seri", target: 7 },
      { id: "streak_30", label: "30 Gunluk Seri", target: 30 },
    ],
  },
};

export const MARKET_ITEMS = [
  { id: 1, label: "XP Boost (1 Gun)", price: 50, desc: "1 gun boyunca daha hizli ilerleme." },
  { id: 2, label: "Altin Boost (1 Gun)", price: 30, desc: "Kisa sureli altin avantaji." },
  { id: 3, label: "Ozel Avatar Cercevesi", price: 100, desc: "Profil gorunumunu ozellestir." },
  { id: 4, label: "Ozel Tema", price: 150, desc: "Farkli renk temasi ac." },
  { id: 5, label: "Seri Koruma", price: 200, desc: "1 kez seri koruma hakki." },
  { id: 6, label: "Ekstra Soru Paketi", price: 75, desc: "Yeni soru paketi avantajlari." },
];

export function calculateStreakFromReports(raporlar) {
  const sortedDays = [
    ...new Set(
      (raporlar || [])
        .filter((r) => r.finishedAt)
        .map((r) => new Date(r.finishedAt).toLocaleDateString("tr-TR"))
    ),
  ];
  if (!sortedDays.length) return 0;

  const parseTRDate = (d) => {
    const [day, month, year] = d.split(".");
    return new Date(Number(year), Number(month) - 1, Number(day));
  };

  const ordered = sortedDays.map(parseTRDate).sort((a, b) => b - a);
  let count = 1;
  for (let i = 1; i < ordered.length; i += 1) {
    const diff = Math.round((ordered[i - 1] - ordered[i]) / 86400000);
    if (diff === 1) count += 1;
    else break;
  }
  return count;
}

export function computeGamificationStats(raporlar, streak, extraBonus = { xp: 0, gold: 0 }) {
  const totalCorrect = raporlar.reduce((a, r) => a + (r.correctCount || 0), 0);
  const totalSolved = raporlar.reduce((a, r) => a + (r.totalCount || 0), 0);
  const today = new Date().toLocaleDateString("tr-TR");
  const todays = raporlar.filter((r) => r.finishedAt && new Date(r.finishedAt).toLocaleDateString("tr-TR") === today);
  const dailySolved = todays.reduce((a, r) => a + (r.totalCount || 0), 0);
  const dailyCorrect = todays.reduce((a, r) => a + (r.correctCount || 0), 0);

  const dailyReward = calculateDailyReward(dailySolved, dailyCorrect);
  const baseXP = totalCorrect * 5 + totalSolved;
  const xp = baseXP + (dailyReward.xp || 0) + Number(extraBonus?.xp || 0);
  const gold = Math.floor(xp / 10) + (dailyReward.gold || 0) + Number(extraBonus?.gold || 0);
  const levelData = calculateLevelFromXP(xp);
  const milestones = checkMilestones(xp, totalCorrect, streak);

  const earnedBadgeIds = [];
  if (xp >= 100) earnedBadgeIds.push("xp_100");
  if (xp >= 500) earnedBadgeIds.push("xp_500");
  if (xp >= 1500) earnedBadgeIds.push("xp_1500");
  if (xp >= 5000) earnedBadgeIds.push("xp_5000");
  if (dailySolved >= 30) earnedBadgeIds.push("daily_30");
  if (dailySolved >= 50) earnedBadgeIds.push("daily_50");
  if (dailySolved >= 100) earnedBadgeIds.push("daily_100");
  if (totalCorrect >= 200) earnedBadgeIds.push("acc_200");
  if (totalCorrect >= 500) earnedBadgeIds.push("acc_500");
  if (totalCorrect >= 1000) earnedBadgeIds.push("acc_1000");
  if (streak >= 3) earnedBadgeIds.push("streak_3");
  if (streak >= 7) earnedBadgeIds.push("streak_7");
  if (streak >= 30) earnedBadgeIds.push("streak_30");

  return {
    xp,
    gold,
    totalCorrect,
    totalSolved,
    dailySolved,
    dailyCorrect,
    dailyNotices: dailyReward.notices || [],
    milestones,
    earnedBadgeIds,
    ...levelData,
  };
}
