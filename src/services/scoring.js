// Gelişmiş Puanlama Sistemi
// Bu servis tüm puan hesaplamalarını yönetir

export const SCORING_CONFIG = {
  // Temel XP değerleri
  BASE_XP: {
    CORRECT_ANSWER: 5,
    SOLVED_QUESTION: 1,
    WRONG_ANSWER: 0,
    EMPTY_ANSWER: 0
  },
  
  // Zaman bonusları (saniye cinsinden)
  TIME_BONUS: {
    VERY_FAST: { threshold: 10, multiplier: 1.5 }, // 10 saniyeden az
    FAST: { threshold: 20, multiplier: 1.3 },        // 20 saniyeden az
    NORMAL: { threshold: 40, multiplier: 1.0 },      // 40 saniyeden az
    SLOW: { threshold: 60, multiplier: 0.8 }        // 60 saniyeden fazla
  },
  
  // Zorluk bonusları
  DIFFICULTY_BONUS: {
    VERY_EASY: 1.0,
    EASY: 1.2,
    MEDIUM: 1.5,
    HARD: 2.0,
    VERY_HARD: 2.5
  },
  
  // Kombo sistemi
  COMBO_BONUS: {
    MIN_COMBO: 3,        // Minimum 3 ardışık doğru
    BASE_MULTIPLIER: 1.1, // Her kombo için %10 bonus
    MAX_MULTIPLIER: 2.0   // Maksimum %100 bonus
  },
  
  // Streak bonusları
  STREAK_BONUS: {
    MIN_STREAK: 3,       // Minimum 3 günlük streak
    BASE_MULTIPLIER: 1.1, // Her 3 gün için %10 bonus
    MAX_MULTIPLIER: 1.5   // Maksimum %50 bonus
  },
  
  // Altın dönüşümü
  GOLD_CONVERSION: {
    XP_TO_GOLD: 10,      // 10 XP = 1 Altın
    MIN_XP_FOR_GOLD: 50  // Minimum 50 XP'den altına çevrilebilir
  },
  
  // Level sistemi
  LEVEL_SYSTEM: {
    BASE_XP_PER_LEVEL: 100,
    XP_MULTIPLIER: 1.1   // Her level için %10 daha fazla XP gerekir
  }
};

/**
 * Soru cevabı için XP hesapla
 * @param {Object} params - Hesaplama parametreleri
 * @param {boolean} params.isCorrect - Doğru mu?
 * @param {number} params.timeSpent - Harcanan süre (saniye)
 * @param {string} params.difficulty - Zorluk seviyesi
 * @param {number} params.currentCombo - Mevcut kombo sayısı
 * @param {number} params.currentStreak - Mevcut streak (gün)
 * @returns {Object} { xp, gold, bonuses }
 */
export function calculateQuestionXP({
  isCorrect = false,
  timeSpent = 0,
  difficulty = 'MEDIUM',
  currentCombo = 0,
  currentStreak = 0
}) {
  let baseXP = 0;
  let bonuses = [];
  let totalXP = 0;
  let gold = 0;
  
  // Temel XP
  if (isCorrect) {
    baseXP = SCORING_CONFIG.BASE_XP.CORRECT_ANSWER;
  } else {
    baseXP = SCORING_CONFIG.BASE_XP.WRONG_ANSWER;
  }
  
  // Zaman bonusu (sadece doğru cevaplar için)
  if (isCorrect && timeSpent > 0) {
    let timeMultiplier = 1.0;
    let timeBonus = 0;
    
    if (timeSpent <= SCORING_CONFIG.TIME_BONUS.VERY_FAST.threshold) {
      timeMultiplier = SCORING_CONFIG.TIME_BONUS.VERY_FAST.multiplier;
      timeBonus = baseXP * (timeMultiplier - 1);
      bonuses.push({ type: 'time', name: 'Çok Hızlı!', value: `+${timeBonus.toFixed(0)} XP` });
    } else if (timeSpent <= SCORING_CONFIG.TIME_BONUS.FAST.threshold) {
      timeMultiplier = SCORING_CONFIG.TIME_BONUS.FAST.multiplier;
      timeBonus = baseXP * (timeMultiplier - 1);
      bonuses.push({ type: 'time', name: 'Hızlı!', value: `+${timeBonus.toFixed(0)} XP` });
    } else if (timeSpent > SCORING_CONFIG.TIME_BONUS.SLOW.threshold) {
      timeMultiplier = SCORING_CONFIG.TIME_BONUS.SLOW.multiplier;
      timeBonus = baseXP * (timeMultiplier - 1);
      bonuses.push({ type: 'time', name: 'Yavaş', value: `${timeBonus.toFixed(0)} XP` });
    }
    
    baseXP *= timeMultiplier;
  }
  
  // Zorluk bonusu
  if (isCorrect) {
    const difficultyMultiplier = SCORING_CONFIG.DIFFICULTY_BONUS[difficulty] || 1.0;
    const difficultyBonus = baseXP * (difficultyMultiplier - 1);
    if (difficultyBonus > 0) {
      bonuses.push({ 
        type: 'difficulty', 
        name: `${difficulty} Zorluk`, 
        value: `+${difficultyBonus.toFixed(0)} XP` 
      });
    }
    baseXP *= difficultyMultiplier;
  }
  
  // Kombo bonusu
  if (isCorrect && currentCombo >= SCORING_CONFIG.COMBO_BONUS.MIN_COMBO) {
    const comboMultiplier = Math.min(
      1 + (currentCombo - SCORING_CONFIG.COMBO_BONUS.MIN_COMBO) * 0.1,
      SCORING_CONFIG.COMBO_BONUS.MAX_MULTIPLIER
    );
    const comboBonus = baseXP * (comboMultiplier - 1);
    bonuses.push({ 
      type: 'combo', 
      name: `${currentCombo} Kombo!`, 
      value: `+${comboBonus.toFixed(0)} XP` 
    });
    baseXP *= comboMultiplier;
  }
  
  // Streak bonusu
  if (isCorrect && currentStreak >= SCORING_CONFIG.STREAK_BONUS.MIN_STREAK) {
    const streakMultiplier = Math.min(
      1 + Math.floor(currentStreak / 3) * 0.1,
      SCORING_CONFIG.STREAK_BONUS.MAX_MULTIPLIER
    );
    const streakBonus = baseXP * (streakMultiplier - 1);
    bonuses.push({ 
      type: 'streak', 
      name: `${currentStreak} Günlük Seri!`, 
      value: `+${streakBonus.toFixed(0)} XP` 
    });
    baseXP *= streakMultiplier;
  }
  
  totalXP = Math.round(baseXP);
  
  // Altın hesaplama (sadece doğru cevaplar için)
  if (isCorrect && totalXP >= SCORING_CONFIG.GOLD_CONVERSION.MIN_XP_FOR_GOLD) {
    gold = Math.floor(totalXP / SCORING_CONFIG.GOLD_CONVERSION.XP_TO_GOLD);
  }
  
  return {
    xp: totalXP,
    gold: gold,
    bonuses: bonuses,
    baseXP: SCORING_CONFIG.BASE_XP.CORRECT_ANSWER,
    breakdown: {
      base: SCORING_CONFIG.BASE_XP.CORRECT_ANSWER,
      time: timeSpent,
      difficulty: difficulty,
      combo: currentCombo,
      streak: currentStreak
    }
  };
}

/**
 * Level için gerekli XP hesapla
 * @param {number} level - Hedef level
 * @returns {number} Gerekli toplam XP
 */
export function calculateXPForLevel(level) {
  if (level <= 1) return 0;
  
  let totalXP = 0;
  for (let i = 1; i < level; i++) {
    totalXP += SCORING_CONFIG.LEVEL_SYSTEM.BASE_XP_PER_LEVEL * Math.pow(SCORING_CONFIG.LEVEL_SYSTEM.XP_MULTIPLIER, i - 1);
  }
  
  return Math.round(totalXP);
}

/**
 * XP'den level hesapla
 * @param {number} totalXP - Toplam XP
 * @returns {Object} { level, progress, nextLevelXP }
 */
export function calculateLevelFromXP(totalXP) {
  let level = 1;
  let currentXP = totalXP;
  let requiredXP = 0;
  
  while (currentXP >= requiredXP) {
    requiredXP = SCORING_CONFIG.LEVEL_SYSTEM.BASE_XP_PER_LEVEL * Math.pow(SCORING_CONFIG.LEVEL_SYSTEM.XP_MULTIPLIER, level - 1);
    if (currentXP >= requiredXP) {
      currentXP -= requiredXP;
      level++;
    } else {
      break;
    }
  }
  
  const progress = Math.round((currentXP / requiredXP) * 100);
  const nextLevelXP = requiredXP;
  
  return {
    level: level,
    progress: progress,
    currentXP: currentXP,
    nextLevelXP: nextLevelXP,
    totalXP: totalXP
  };
}

/**
 * Günlük ödül hesapla
 * @param {number} dailySolved - Günlük çözülen soru sayısı
 * @param {number} dailyCorrect - Günlük doğru cevap sayısı
 * @returns {Object} { xp, gold, bonus }
 */
export function calculateDailyReward(dailySolved, dailyCorrect) {
  let xp = 0;
  let gold = 0;
  let bonus = null;
  
  // Temel ödüller
  xp += dailySolved * SCORING_CONFIG.BASE_XP.SOLVED_QUESTION;
  xp += dailyCorrect * SCORING_CONFIG.BASE_XP.CORRECT_ANSWER;
  
  // Günlük hedef ödülleri
  if (dailySolved >= 30) {
    xp += 20;
    gold += 2;
    bonus = { type: 'daily_goal', name: 'Günlük Hedef Tamamlandı!', value: '+20 XP, +2 Altın' };
  }
  
  if (dailyCorrect >= 20) {
    xp += 15;
    gold += 1;
    if (!bonus) {
      bonus = { type: 'accuracy', name: 'Yüksek Doğruluk!', value: '+15 XP, +1 Altın' };
    }
  }
  
  return { xp, gold, bonus };
}

/**
 * Milestone ödülleri kontrol et
 * @param {number} totalXP - Toplam XP
 * @param {number} totalCorrect - Toplam doğru cevap
 * @param {number} streak - Günlük streak
 * @returns {Array} Milestone ödülleri
 */
export function checkMilestones(totalXP, totalCorrect, streak) {
  const milestones = [];
  
  // XP milestone'ları
  if (totalXP >= 1000 && totalXP < 1100) {
    milestones.push({ type: 'xp', name: '1000 XP Başarısı!', reward: { xp: 50, gold: 5 } });
  }
  if (totalXP >= 5000 && totalXP < 5100) {
    milestones.push({ type: 'xp', name: '5000 XP Başarısı!', reward: { xp: 100, gold: 10 } });
  }
  
  // Doğru cevap milestone'ları
  if (totalCorrect >= 100 && totalCorrect < 110) {
    milestones.push({ type: 'correct', name: '100 Doğru Cevap!', reward: { xp: 25, gold: 3 } });
  }
  if (totalCorrect >= 500 && totalCorrect < 510) {
    milestones.push({ type: 'correct', name: '500 Doğru Cevap!', reward: { xp: 75, gold: 7 } });
  }
  
  // Streak milestone'ları
  if (streak === 7) {
    milestones.push({ type: 'streak', name: '7 Günlük Seri!', reward: { xp: 40, gold: 4 } });
  }
  if (streak === 30) {
    milestones.push({ type: 'streak', name: '30 Günlük Seri!', reward: { xp: 200, gold: 20 } });
  }
  
  return milestones;
}

/**
 * Raporlardan kullanıcı puanını hesapla
 * @param {Array} raporlar - Kullanıcının tüm raporları
 * @param {number} currentStreak - Mevcut günlük streak
 * @returns {Object} { totalScore, breakdown, stats }
 */
export function calculateUserScoreFromReports(raporlar = [], currentStreak = 0) {
  if (!raporlar || raporlar.length === 0) {
    return {
      totalScore: 0,
      breakdown: {
        baseScore: 0,
        netBonus: 0,
        activityBonus: 0,
        streakBonus: 0,
        accuracyBonus: 0
      },
      stats: {
        totalCorrect: 0,
        totalWrong: 0,
        totalEmpty: 0,
        totalNet: 0,
        accuracy: 0,
        totalReports: 0
      }
    };
  }

  // İstatistikleri hesapla
  const stats = {
    totalCorrect: 0,
    totalWrong: 0,
    totalEmpty: 0,
    totalNet: 0,
    totalReports: raporlar.length
  };

  raporlar.forEach(rapor => {
    stats.totalCorrect += rapor.correctCount || 0;
    stats.totalWrong += rapor.wrongCount || 0;
    stats.totalEmpty += rapor.emptyCount || 0;
    stats.totalNet += rapor.net || 0;
  });

  // Doğruluk oranı
  const totalAnswered = stats.totalCorrect + stats.totalWrong;
  stats.accuracy = totalAnswered > 0 
    ? stats.totalCorrect / totalAnswered 
    : 0;

  // Puan hesaplama
  const breakdown = {
    baseScore: 0,
    netBonus: 0,
    activityBonus: 0,
    streakBonus: 0,
    accuracyBonus: 0
  };

  // 1. Temel Puan
  breakdown.baseScore = (stats.totalCorrect * 10) - Math.round(stats.totalWrong * 2.5);

  // 2. Net Puan Bonusu
  breakdown.netBonus = Math.round(stats.totalNet * 5);

  // 3. Aktivite Bonusları
  if (stats.totalReports >= 100) {
    breakdown.activityBonus += 200;
  } else if (stats.totalReports >= 50) {
    breakdown.activityBonus += 100;
  } else if (stats.totalReports >= 30) {
    breakdown.activityBonus += 50;
  }

  // Son 7 günlük aktivite kontrolü
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentReports = raporlar.filter(rapor => {
    const finishedAt = rapor.finishedAt 
      ? new Date(rapor.finishedAt) 
      : null;
    return finishedAt && finishedAt >= sevenDaysAgo;
  });

  if (recentReports.length >= 100) {
    breakdown.activityBonus += 200;
  } else if (recentReports.length >= 50) {
    breakdown.activityBonus += 100;
  } else if (recentReports.length >= 30) {
    breakdown.activityBonus += 50;
  }

  // 4. Streak Bonusu
  if (currentStreak >= 30) {
    breakdown.streakBonus = 200;
  } else if (currentStreak >= 7) {
    breakdown.streakBonus = 50;
  } else if (currentStreak >= 3) {
    breakdown.streakBonus = 20;
  }

  // 5. Doğruluk Oranı Bonusu
  if (stats.accuracy >= 0.95) {
    breakdown.accuracyBonus = 100;
  } else if (stats.accuracy >= 0.90) {
    breakdown.accuracyBonus = 50;
  } else if (stats.accuracy >= 0.80) {
    breakdown.accuracyBonus = 30;
  }

  // Toplam puan
  const totalScore = Math.max(0, 
    breakdown.baseScore + 
    breakdown.netBonus + 
    breakdown.activityBonus + 
    breakdown.streakBonus + 
    breakdown.accuracyBonus
  );

  return {
    totalScore,
    breakdown,
    stats: {
      ...stats,
      accuracy: Math.round(stats.accuracy * 100) / 100 // 2 ondalık basamak
    }
  };
}





