import { useEffect, useState } from "react";
import "./BadgeCollection.css";

export default function BadgeCollection({ onBack }) {
  const [earnedBadges, setEarnedBadges] = useState([]);

  // Kullanıcının aldığı rozetler localStorage veya props üzerinden gelebilir
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("earnedBadges")) || [];
    setEarnedBadges(saved);
  }, []);

  // -----------------------------
  // ⭐ TÜM ROZETLER (Koleksiyon)
  // -----------------------------
  const allBadges = [
    {
      id: 1,
      name: "🔥 Başlangıç Ustası",
      requirement: "100 XP kazan",
      icon: "🔥"
    },
    {
      id: 2,
      name: "💎 Deneyimli Öğrenci",
      requirement: "500 XP kazan",
      icon: "💎"
    },
    {
      id: 3,
      name: "🏆 Efsane Öğrenci",
      requirement: "1500 XP kazan",
      icon: "🏆"
    },
    {
      id: 4,
      name: "⚡ Günlük Hedef Ustası",
      requirement: "Bir gün içinde 30 soru çöz",
      icon: "⚡"
    },
    {
      id: 5,
      name: "🎯 Keskin Nişancı",
      requirement: "200 doğru cevap yap",
      icon: "🎯"
    },
    {
      id: 6,
      name: "🔥 3 Günlük Seri Rozeti",
      requirement: "3 gün üst üste çalış",
      icon: "🔥"
    },
    {
      id: 7,
      name: "💥 Alevli Seri Ustası",
      requirement: "7 gün üst üste çalış",
      icon: "💥"
    },
    {
      id: 8,
      name: "🏅 30 Günlük Mega Seri",
      requirement: "30 gün üst üste çalış",
      icon: "🏅"
    }
  ];

  return (
    <div className="badge-collection-container">
      <h1 className="title">🏅 Rozet Koleksiyonu</h1>

      <div className="badge-grid">
        {allBadges.map((badge) => {
          const isUnlocked = earnedBadges.includes(badge.name);

          return (
            <div
              key={badge.id}
              className={`badge-card ${isUnlocked ? "unlocked" : "locked"}`}
            >
              <div className="badge-icon">
                {isUnlocked ? badge.icon : "🔒"}
              </div>
              <div className="badge-name">{badge.name}</div>
              <div className="badge-req">
                {isUnlocked
                  ? "✔ Açıldı!"
                  : `Açmak için: ${badge.requirement}`}
              </div>
            </div>
          );
        })}
      </div>

      <button className="back-btn" onClick={onBack}>
        ◀ Geri Dön
      </button>
    </div>
  );
}
