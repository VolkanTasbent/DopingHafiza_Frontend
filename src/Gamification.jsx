import { useEffect, useState, useMemo } from "react";
import api from "./services/api";
import confetti from "canvas-confetti";
import { calculateLevelFromXP, calculateDailyReward, checkMilestones } from "./services/scoring";
import "./Gamification.css";

// Rozet kategorileri - component dışında tanımlandı (her render'da yeniden oluşturulmasın)
const rozetKategorileri = {
  xp: {
    name: "XP Rozetleri",
    rozetler: [
      { id: "xp_100", ad: "🔥 Başlangıç Ustası", icon: "🔥", gereksinim: 100, aciklama: "100 XP kazan" },
      { id: "xp_500", ad: "💎 Deneyimli Öğrenci", icon: "💎", gereksinim: 500, aciklama: "500 XP kazan" },
      { id: "xp_1500", ad: "🏆 Efsane Öğrenci", icon: "🏆", gereksinim: 1500, aciklama: "1500 XP kazan" },
      { id: "xp_5000", ad: "👑 Ustası", icon: "👑", gereksinim: 5000, aciklama: "5000 XP kazan" },
    ]
  },
  daily: {
    name: "Günlük Rozetler",
    rozetler: [
      { id: "daily_30", ad: "⚡ Günlük Hedef Ustası", icon: "⚡", gereksinim: 30, aciklama: "Bir günde 30 soru çöz" },
      { id: "daily_50", ad: "🌟 Süper Günlük", icon: "🌟", gereksinim: 50, aciklama: "Bir günde 50 soru çöz" },
      { id: "daily_100", ad: "🚀 Efsane Gün", icon: "🚀", gereksinim: 100, aciklama: "Bir günde 100 soru çöz" },
    ]
  },
  accuracy: {
    name: "Doğruluk Rozetleri",
    rozetler: [
      { id: "acc_200", ad: "🎯 Keskin Nişancı", icon: "🎯", gereksinim: 200, aciklama: "200 doğru cevap ver" },
      { id: "acc_500", ad: "🏹 Usta Nişancı", icon: "🏹", gereksinim: 500, aciklama: "500 doğru cevap ver" },
      { id: "acc_1000", ad: "🎖️ Efsane Nişancı", icon: "🎖️", gereksinim: 1000, aciklama: "1000 doğru cevap ver" },
    ]
  },
  streak: {
    name: "Seri Rozetleri",
    rozetler: [
      { id: "streak_3", ad: "🔥 3 Günlük Seri", icon: "🔥", gereksinim: 3, aciklama: "3 gün üst üste çalış" },
      { id: "streak_7", ad: "💥 Alevli Seri Ustası", icon: "💥", gereksinim: 7, aciklama: "7 gün üst üste çalış" },
      { id: "streak_30", ad: "🏆 Efsane Seri", icon: "🏆", gereksinim: 30, aciklama: "30 gün üst üste çalış" },
    ]
  }
};

// Market ürünleri - component dışında tanımlandı
const marketUrunleri = [
  { id: 1, ad: "XP Boost (1 Gün)", fiyat: 50, tip: "boost", icon: "⚡", aciklama: "1 gün boyunca %20 daha fazla XP kazan" },
  { id: 2, ad: "Altın Boost (1 Gün)", fiyat: 30, tip: "boost", icon: "💰", aciklama: "1 gün boyunca %30 daha fazla altın kazan" },
  { id: 3, ad: "Özel Avatar Çerçevesi", fiyat: 100, tip: "cosmetic", icon: "🖼️", aciklama: "Profilinde özel çerçeve görünsün" },
  { id: 4, ad: "Özel Tema", fiyat: 150, tip: "cosmetic", icon: "🎨", aciklama: "Uygulamada özel tema kullan" },
  { id: 5, ad: "Seri Koruma", fiyat: 200, tip: "utility", icon: "🛡️", aciklama: "1 kez serini koru (seri bozulmasın)" },
  { id: 6, ad: "Ekstra Soru Paketi", fiyat: 75, tip: "utility", icon: "📚", aciklama: "Özel soru paketine erişim" },
];

function readArrayFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Gamification({ onBack }) {
  // ---------------------------
  // 🟦 STATE'LER
  // ---------------------------
  const [xp, setXp] = useState(0);
  const [gold, setGold] = useState(0);
  const [level, setLevel] = useState(1);
  const [progress, setProgress] = useState(0);
  const [nextLevelXP, setNextLevelXP] = useState(100);
  const [currentXP, setCurrentXP] = useState(0);
  const [dailySolved, setDailySolved] = useState(0);
  const [dailyCorrect, setDailyCorrect] = useState(0);
  const [badges, setBadges] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [showMilestone, setShowMilestone] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState(null);

  const [previousLevel, setPreviousLevel] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  // 🔥 STREAK STATES
  const [streak, setStreak] = useState(0);
  const [lastActive, setLastActive] = useState(null);
  const [showStreakUp, setShowStreakUp] = useState(false);

  // MESSAGE STATE
  const [msg, setMsg] = useState("");

  // 🛒 MARKET STATES
  const [marketAcik, setMarketAcik] = useState(false);
  const [satinAlinanlar, setSatinAlinanlar] = useState(() =>
    readArrayFromStorage("satinAlinanlar")
  );

  // Raporlar state'i - rozet hesaplamaları için
  const [raporlar, setRaporlar] = useState([]);

  // Rozet ilerlemesini hesapla
  const rozetIlerlemeleri = useMemo(() => {
    const ilerlemeler = {};
    
    // badges undefined kontrolü
    const badgesArray = Array.isArray(badges) ? badges : [];
    
    // Doğruluk rozetleri için totalCorrect hesapla
    const totalCorrect = raporlar.reduce((a, r) => a + (r.correctCount || 0), 0);
    
    // XP rozetleri
    rozetKategorileri.xp.rozetler.forEach(rozet => {
      const kazanildi = badgesArray.some(b => b && typeof b === 'string' && b.includes(rozet.ad));
      const mevcutDeger = xp || 0;
      ilerlemeler[rozet.id] = {
        kazanildi,
        mevcutDeger,
        gereksinim: rozet.gereksinim,
        yuzde: Math.min(100, Math.max(0, (mevcutDeger / rozet.gereksinim) * 100))
      };
    });

    // Günlük rozetler
    rozetKategorileri.daily.rozetler.forEach(rozet => {
      const kazanildi = badgesArray.some(b => b && typeof b === 'string' && b.includes(rozet.ad));
      const mevcutDeger = dailySolved || 0;
      ilerlemeler[rozet.id] = {
        kazanildi,
        mevcutDeger,
        gereksinim: rozet.gereksinim,
        yuzde: Math.min(100, Math.max(0, (mevcutDeger / rozet.gereksinim) * 100))
      };
    });

    // Doğruluk rozetleri
    rozetKategorileri.accuracy.rozetler.forEach(rozet => {
      const kazanildi = badgesArray.some(b => b && typeof b === 'string' && b.includes(rozet.ad));
      const mevcutDeger = totalCorrect || 0;
      ilerlemeler[rozet.id] = {
        kazanildi,
        mevcutDeger,
        gereksinim: rozet.gereksinim,
        yuzde: Math.min(100, Math.max(0, (mevcutDeger / rozet.gereksinim) * 100))
      };
    });

    // Seri rozetleri
    rozetKategorileri.streak.rozetler.forEach(rozet => {
      const kazanildi = badgesArray.some(b => b && typeof b === 'string' && b.includes(rozet.ad));
      const mevcutDeger = streak || 0;
      ilerlemeler[rozet.id] = {
        kazanildi,
        mevcutDeger,
        gereksinim: rozet.gereksinim,
        yuzde: Math.min(100, Math.max(0, (mevcutDeger / rozet.gereksinim) * 100))
      };
    });

    return ilerlemeler;
  }, [raporlar, badges, xp, dailySolved, streak]);

  // Satın alma fonksiyonu
  const satinAl = (urun) => {
    if (satinAlinanlar.includes(urun.id)) {
      setMsg("Bu ürün zaten satın alınmış!");
      setTimeout(() => setMsg(""), 3000);
      return;
    }

    if (gold < urun.fiyat) {
      setMsg("Yeterli altın yok! Daha fazla soru çözerek altın kazanabilirsin.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }

    setGold(prev => prev - urun.fiyat);
    setSatinAlinanlar(prev => {
      const yeni = [...prev, urun.id];
      localStorage.setItem("satinAlinanlar", JSON.stringify(yeni));
      return yeni;
    });

    setMsg(`${urun.ad} satın alındı! 🎉`);
    setTimeout(() => setMsg(""), 3000);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 }
    });
  };

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
    try {
      const { data } = await api.get("/api/raporlar", { params: { limit: 200 } });
      
      // Veri kontrolü - eğer data yoksa veya array değilse boş array kullan
      const raporlarData = Array.isArray(data) ? data : [];
      setRaporlar(raporlarData);

    const totalCorrect = raporlarData.reduce((a, r) => a + (r.correctCount || 0), 0);
    const totalSolved = raporlarData.reduce((a, r) => a + (r.totalCount || 0), 0);

    const today = new Date().toLocaleDateString("tr-TR");
    const todays = raporlarData.filter(
      (r) => r.finishedAt && new Date(r.finishedAt).toLocaleDateString("tr-TR") === today
    );

    const daily = todays.reduce((a, r) => a + (r.totalCount || 0), 0);
    const dailyCorrectCount = todays.reduce((a, r) => a + (r.correctCount || 0), 0);
    setDailySolved(daily);
    setDailyCorrect(dailyCorrectCount);

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
    // 🟦 XP HESABI (Gelişmiş Sistem)
    // ---------------------------
    const xpFromCorrect = totalCorrect * 5;
    const xpFromSolved = totalSolved * 1;
    const xpTotal = xpFromCorrect + xpFromSolved;
    
    // Günlük ödüller
    const dailyReward = calculateDailyReward(daily, dailyCorrectCount);
    const totalXP = xpTotal + (dailyReward.xp || 0);
    
    // Altın hesaplama
    const totalGold = Math.floor(totalXP / 10) + (dailyReward.gold || 0);
    
    // Level hesaplama (yeni sistem)
    const levelData = calculateLevelFromXP(totalXP);
    const currentLevel = levelData.level;
    const progressPercent = levelData.progress;
    const nextXP = levelData.nextLevelXP;
    const currentXP = levelData.currentXP || 0;

    if (previousLevel !== null && currentLevel > previousLevel) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 2000);
    }

    setPreviousLevel(currentLevel);
    setXp(totalXP);
    setGold(totalGold);
    setLevel(currentLevel === 0 ? 1 : currentLevel);
    setProgress(progressPercent);
    setNextLevelXP(nextXP);
    setCurrentXP(currentXP);
    
    // Milestone kontrolü
    const newMilestones = checkMilestones(totalXP, totalCorrect, streak);
    if (newMilestones.length > 0) {
      const lastMilestone = newMilestones[newMilestones.length - 1];
      setCurrentMilestone(lastMilestone);
      setShowMilestone(true);
      setTimeout(() => setShowMilestone(false), 3000);
      
      // Milestone ödüllerini uygula
      setXp(prev => prev + (lastMilestone.reward.xp || 0));
      setGold(prev => prev + (lastMilestone.reward.gold || 0));
      
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.7 }
      });
    }
    setMilestones(newMilestones);

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
    } catch (error) {
      console.error("Gamification verileri yüklenirken hata:", error);
      // Hata durumunda minimum değerler göster
      setXp(0);
      setGold(0);
      setLevel(1);
      setProgress(0);
      setNextLevelXP(100);
      setDailySolved(0);
      setDailyCorrect(0);
      setBadges([]);
    }
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

        <p>{currentXP}/{nextLevelXP} XP</p>
        <div className="gold-display">
          <span className="gold-icon">🪙</span>
          <span className="gold-amount">{gold} Altın</span>
        </div>
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
        <p>Bugün doğru cevap: <strong>{dailyCorrect}</strong> / 20</p>

        {dailySolved >= 30 ? (
          <div className="daily-done">🔥 Günlük hedef tamamlandı! +20 XP, +2 Altın</div>
        ) : (
          <div className="daily-progress">Devam et! 💪</div>
        )}
        
        {dailyCorrect >= 20 && (
          <div className="daily-done">🎯 Yüksek doğruluk! +15 XP, +1 Altın</div>
        )}
      </div>

      {/* ROZETLER - GELİŞMİŞ SİSTEM */}
      <div className="badge-section">
        <h3>🏅 Rozetler</h3>
        
        {Object.entries(rozetKategorileri).map(([key, kategori]) => {
          const ilerlemeler = rozetIlerlemeleri;
          
          return (
            <div key={key} className="badge-category">
              <h4>{kategori.name}</h4>
              <div className="badge-grid">
                {kategori.rozetler.map((rozet) => {
                  const ilerleme = ilerlemeler[rozet.id] || { kazanildi: false, mevcutDeger: 0, gereksinim: rozet.gereksinim, yuzde: 0 };
                  
                  return (
                    <div 
                      key={rozet.id} 
                      className={`badge-item ${ilerleme.kazanildi ? 'badge-earned' : 'badge-locked'}`}
                    >
                      <div className="badge-icon">{rozet.icon}</div>
                      <div className="badge-name">{rozet.ad}</div>
                      <div className="badge-progress">
                        <div className="badge-progress-bar">
                          <div 
                            className="badge-progress-fill" 
                            style={{ width: `${ilerleme.yuzde}%` }}
                          ></div>
                        </div>
                        <div className="badge-progress-text">
                          {ilerleme.kazanildi ? '✓ Kazanıldı' : `${ilerleme.mevcutDeger}/${ilerleme.gereksinim}`}
                        </div>
                      </div>
                      <div className="badge-description">{rozet.aciklama}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* MARKET */}
      <div className="market-section">
        <div className="market-header">
          <h3>🛒 Market</h3>
          <button 
            className="market-toggle-btn"
            onClick={() => setMarketAcik(!marketAcik)}
          >
            {marketAcik ? '▼ Kapat' : '▶ Aç'}
          </button>
        </div>
        
        {marketAcik && (
          <div className="market-content">
            <div className="market-balance">
              <span className="gold-icon">🪙</span>
              <span className="gold-amount">{gold} Altın</span>
            </div>
            
            <div className="market-grid">
              {marketUrunleri.map((urun) => {
                const satinAlindi = satinAlinanlar.includes(urun.id);
                
                return (
                  <div 
                    key={urun.id} 
                    className={`market-item ${satinAlindi ? 'market-item-owned' : ''}`}
                  >
                    <div className="market-item-icon">{urun.icon}</div>
                    <div className="market-item-name">{urun.ad}</div>
                    <div className="market-item-description">{urun.aciklama}</div>
                    <div className="market-item-price">
                      {satinAlindi ? (
                        <span className="market-item-owned-text">✓ Satın Alındı</span>
                      ) : (
                        <>
                          <span className="gold-icon">🪙</span>
                          <span>{urun.fiyat} Altın</span>
                        </>
                      )}
                    </div>
                    {!satinAlindi && (
                      <button
                        className="market-buy-btn"
                        onClick={() => satinAl(urun)}
                        disabled={gold < urun.fiyat}
                      >
                        {gold < urun.fiyat ? 'Yetersiz Altın' : 'Satın Al'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div className="gami-message" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#10b981',
          color: 'white',
          padding: '15px 20px',
          borderRadius: '10px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
          zIndex: 1000
        }}>
          {msg}
        </div>
      )}

      <button className="back-btn" onClick={onBack}>◀ Geri Dön</button>
      

      {/* LEVEL UP POPUP */}
      {showLevelUp && (
        <div className="levelup-overlay">
          <div className="levelup-box">
            <h1 className="levelup-title">🎉 Seviye Atladın!</h1>
            <p className="levelup-text">Yeni Seviyen: {level}</p>
            <p className="levelup-reward">+50 XP, +5 Altın Ödülü!</p>
          </div>
        </div>
      )}

      {/* MILESTONE POPUP */}
      {showMilestone && currentMilestone && (
        <div className="levelup-overlay">
          <div className="levelup-box milestone-box">
            <h1 className="levelup-title">🏆 Başarım Kazandın!</h1>
            <p className="levelup-text">{currentMilestone.name}</p>
            <p className="levelup-reward">
              +{currentMilestone.reward.xp} XP, +{currentMilestone.reward.gold} Altın
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
