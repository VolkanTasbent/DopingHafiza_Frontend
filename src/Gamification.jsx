import { useEffect, useState } from "react";
import api from "./services/api";
import confetti from "canvas-confetti";
import "./Gamification.css";

export default function Gamification({ onBack }) {
  // ---------------------------
  // 🟦 STATE'LER
  // ---------------------------
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [progress, setProgress] = useState(0);
  const [dailySolved, setDailySolved] = useState(0);
  const [badges, setBadges] = useState([]);

  const [previousLevel, setPreviousLevel] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  // 🔥 STREAK STATES
  const [streak, setStreak] = useState(0);
  const [lastActive, setLastActive] = useState(null);
  const [showStreakUp, setShowStreakUp] = useState(false);

  // ---------------------------
  // 🟦 LEVEL-UP ANİMASYONU
  // ---------------------------
  useEffect(() => {
    if (showLevelUp) {
      confetti({
        particleCount: 130,
        spread: 80,
        origin: { y: 0.7 }
      });
    }
  }, [showLevelUp]);

  // ---------------------------
  // 🟦 İLK YÜKLEMEDE VERİLERİ ÇEK
  // ---------------------------
  useEffect(() => {
    loadGamificationData();
  }, []);

  // ---------------------------
  // 🟦 STREAK ÖDÜLÜ
  // ---------------------------
  const giveStreakReward = (xpAmount, msg) => {
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.7 }
    });

    console.log("STREAK ÖDÜLÜ:", msg, xpAmount, "XP");
    setShowStreakUp(true);
    setTimeout(() => setShowStreakUp(false), 2000);
  };

  // ---------------------------
  // 🟦 XP – LEVEL – ROZET – STREAK HESAPLAMA
  // ---------------------------
  const loadGamificationData = async () => {
    const { data } = await api.get("/api/raporlar", { params: { limit: 200 } });

    const totalCorrect = data.reduce((a, r) => a + (r.correctCount || 0), 0);
    const totalSolved = data.reduce((a, r) => a + (r.totalCount || 0), 0);

    const today = new Date().toLocaleDateString("tr-TR");
    const todays = data.filter(
      (r) => new Date(r.finishedAt).toLocaleDateString("tr-TR") === today
    );

    const daily = todays.reduce((a, r) => a + (r.totalCount || 0), 0);
    setDailySolved(daily);

    // ---------------------------
    // 🟦 STREAK (KESİNTİSİZ ÇALIŞMA)
    // ---------------------------
    const saved = JSON.parse(localStorage.getItem("streakData")) || { streak: 0, last: null };
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("tr-TR");

    if (saved.last === today) {
      setStreak(saved.streak); // bugün zaten giriş yapmış
    } else if (saved.last === yesterday) {
      const newStreak = saved.streak + 1;
      setStreak(newStreak);

      // ÖDÜLLER
      if (newStreak === 1) giveStreakReward(5, "1 Günlük Seri!");
      if (newStreak === 3) giveStreakReward(15, "3 Günlük Seri! (Rozet Kazandın!)");
      if (newStreak === 7) giveStreakReward(40, "7 Günlük Seri! 🔥 Özel Rozet!");
      if (newStreak === 30) giveStreakReward(100, "30 Günlük Seri! 🏆 Büyük Ödül!");

      // KAYDET
      localStorage.setItem("streakData", JSON.stringify({ streak: newStreak, last: today }));
    } else {
      setStreak(0);
      localStorage.setItem("streakData", JSON.stringify({ streak: 0, last: today }));
    }

    setLastActive(today);

    // ---------------------------
    // 🟦 XP HESABI
    // ---------------------------
    const xpFromCorrect = totalCorrect * 5;
    const xpFromSolved = totalSolved * 1;
    const xpTotal = xpFromCorrect + xpFromSolved;

    // Level Hesaplama
    const currentLevel = Math.floor(xpTotal / 100);
    const progressPercent = Math.floor((xpTotal % 100) / 100 * 100);

    if (previousLevel !== null && currentLevel > previousLevel) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 2000);
    }

    setPreviousLevel(currentLevel);
    setXp(xpTotal);
    setLevel(currentLevel === 0 ? 1 : currentLevel);
    setProgress(progressPercent);

    // ---------------------------
    // 🏅 ROZETLER
    // ---------------------------
    const newBadges = [];
    if (xpTotal >= 100) newBadges.push("🔥 Başlangıç Ustası");
    if (xpTotal >= 500) newBadges.push("💎 Deneyimli Öğrenci");
    if (xpTotal >= 1500) newBadges.push("🏆 Efsane Öğrenci");
    if (daily >= 30) newBadges.push("⚡ Günlük Hedef Ustası");
    if (totalCorrect >= 200) newBadges.push("🎯 Keskin Nişancı");
    if (streak >= 3) newBadges.push("🔥 3 Günlük Seri Rozeti");
    if (streak >= 7) newBadges.push("💥 Alevli Seri Ustası");

    setBadges(newBadges);

    localStorage.setItem("earnedBadges", JSON.stringify(newBadges));
  };

  // ---------------------------
  // 🟦 ARAYÜZ
  // ---------------------------
  return (
    <div className="gami-container">
      <h1 className="gami-title">🎮 Gamification Sistemi</h1>

      {/* LEVEL CARD */}
      <div className="level-card">
        <h2>Seviye {level}</h2>

        <div className="xp-bar">
          <div className="xp-fill" style={{ width: `${progress}%` }}></div>
        </div>

        <p>{xp % 100}/100 XP</p>
      </div>

      {/* 🔥 STREAK */}
      <div className="streak-card">
        <h3>🔥 Seri: {streak} Gün</h3>

        {streak === 0 && <p>Seri bozuldu 😢</p>}
        {streak >= 7 && <p>Harikasın! 🔥🔥🔥</p>}
        {showStreakUp && <p className="streak-up">🔥 Seri Arttı!</p>}
      </div>

      {/* GÜNLÜK HEDEF */}
      <div className="daily-card">
        <h3>📅 Günlük Hedef</h3>
        <p>Bugün çözülen soru: <strong>{dailySolved}</strong> / 30</p>

        {dailySolved >= 30 ? (
          <div className="daily-done">🔥 Günlük hedef tamamlandı! +20 XP</div>
        ) : (
          <div className="daily-progress">Devam et! 💪</div>
        )}
      </div>

      {/* ROZETLER */}
      <div className="badge-section">
        <h3>🏅 Rozetler</h3>

        {badges.length === 0 && <p>Henüz rozetin yok.</p>}

        <div className="badge-grid">
          {badges.map((b, i) => (
            <div key={i} className="badge-item">{b}</div>
          ))}
        </div>
        
      </div>

      <button className="back-btn" onClick={onBack}>◀ Geri Dön</button>
      

      {/* LEVEL UP POPUP */}
      {showLevelUp && (
        <div className="levelup-overlay">
          <div className="levelup-box">
            <h1 className="levelup-title">🎉 Seviye Atladın!</h1>
            <p className="levelup-text">Yeni Seviyen: {level}</p>
          </div>
        </div>
      )}
    </div>
  );
}
