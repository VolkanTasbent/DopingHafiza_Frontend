export const SCORING_CONFIG = {
  BASE_XP: {
    CORRECT_ANSWER: 5,
    SOLVED_QUESTION: 1,
  },
  LEVEL_SYSTEM: {
    BASE_XP_PER_LEVEL: 100,
    XP_MULTIPLIER: 1.1,
  },
};

export function calculateLevelFromXP(totalXP) {
  let level = 1;
  let currentXP = totalXP;
  let requiredXP = SCORING_CONFIG.LEVEL_SYSTEM.BASE_XP_PER_LEVEL;

  while (currentXP >= requiredXP) {
    currentXP -= requiredXP;
    level += 1;
    requiredXP = Math.round(
      SCORING_CONFIG.LEVEL_SYSTEM.BASE_XP_PER_LEVEL *
        Math.pow(SCORING_CONFIG.LEVEL_SYSTEM.XP_MULTIPLIER, level - 1)
    );
  }

  const progress = requiredXP > 0 ? Math.round((currentXP / requiredXP) * 100) : 0;
  return { level, progress, currentXP, nextLevelXP: requiredXP, totalXP };
}

export function calculateDailyReward(dailySolved, dailyCorrect) {
  let xp = 0;
  let gold = 0;
  const notices = [];

  xp += dailySolved * SCORING_CONFIG.BASE_XP.SOLVED_QUESTION;
  xp += dailyCorrect * SCORING_CONFIG.BASE_XP.CORRECT_ANSWER;

  if (dailySolved >= 30) {
    xp += 20;
    gold += 2;
    notices.push("Gunluk hedef tamamlandi (+20 XP, +2 altin)");
  }
  if (dailyCorrect >= 20) {
    xp += 15;
    gold += 1;
    notices.push("Yuksek dogruluk bonusu (+15 XP, +1 altin)");
  }

  return { xp, gold, notices };
}

export function checkMilestones(totalXP, totalCorrect, streak) {
  const milestones = [];

  if (totalXP >= 1000 && totalXP < 1100) {
    milestones.push({ id: "xp_1000", name: "1000 XP basarisi", reward: { xp: 50, gold: 5 } });
  }
  if (totalXP >= 5000 && totalXP < 5100) {
    milestones.push({ id: "xp_5000", name: "5000 XP basarisi", reward: { xp: 100, gold: 10 } });
  }
  if (totalCorrect >= 100 && totalCorrect < 110) {
    milestones.push({ id: "correct_100", name: "100 dogru cevap", reward: { xp: 25, gold: 3 } });
  }
  if (streak === 7) {
    milestones.push({ id: "streak_7", name: "7 gun seri", reward: { xp: 40, gold: 4 } });
  }
  if (streak === 30) {
    milestones.push({ id: "streak_30", name: "30 gun seri", reward: { xp: 200, gold: 20 } });
  }

  return milestones;
}
