import { useEffect, useState, useMemo } from "react";
import "./FlashCard.css";
import api from "./services/api";

// SM-2 Spaced Repetition Algoritması
const SM2_ALGORITHM = {
  // Başlangıç değerleri
  INITIAL_EASE: 2.5,
  MIN_EASE: 1.3,
  MAX_EASE: 2.5,
  
  // Interval'lar (gün cinsinden)
  calculateNextInterval: (repetitions, easeFactor, quality) => {
    if (quality < 3) {
      // Yanlış cevap - tekrar baştan
      return 1; // 1 gün sonra
    }
    
    if (repetitions === 0) {
      return 1; // İlk tekrar: 1 gün sonra
    } else if (repetitions === 1) {
      return 6; // İkinci tekrar: 6 gün sonra
    } else {
      // Sonraki tekrarlar: easeFactor ile çarp
      return Math.round((repetitions - 1) * easeFactor);
    }
  },
  
  // Ease factor güncelleme
  updateEaseFactor: (currentEase, quality) => {
    // Quality: 0=çok zor, 1=zor, 2=orta, 3=kolay, 4=çok kolay
    let newEase = currentEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    
    // Min ve max sınırları
    newEase = Math.max(SM2_ALGORITHM.MIN_EASE, Math.min(SM2_ALGORITHM.MAX_EASE, newEase));
    
    return newEase;
  }
};

export default function FlashCard({ onBack, seciliDers }) {
  const [allCards, setAllCards] = useState([]); // Tüm kartlar
  const [currentCard, setCurrentCard] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [konular, setKonular] = useState([]);
  const [seciliKonuId, setSeciliKonuId] = useState("");
  const [loadingKonular, setLoadingKonular] = useState(false);
  
  // İstatistikler
  const [stats, setStats] = useState({
    new: 0,
    learning: 0,
    review: 0,
    mastered: 0
  });
  
  // Kart ilerleme verileri (localStorage'dan)
  const [cardProgress, setCardProgress] = useState(() => {
    try {
      const saved = localStorage.getItem("flashcardProgress");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Tekrar edilecek kartları filtrele
  const reviewCards = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allCards.filter(card => {
      const progress = cardProgress[card.soruId];
      if (!progress) return true; // Yeni kart
      
      if (progress.mastered) return false; // Öğrenilmiş kartlar
      
      const lastReview = progress.lastReview ? new Date(progress.lastReview) : null;
      if (!lastReview) return true; // Henüz tekrar edilmemiş
      
      const daysSinceReview = Math.floor((today - lastReview) / (1000 * 60 * 60 * 24));
      return daysSinceReview >= progress.interval;
    });
  }, [allCards, cardProgress]);

  // İstatistikleri hesapla
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let masteredCount = 0;
    
    allCards.forEach(card => {
      const progress = cardProgress[card.soruId];
      if (!progress) {
        newCount++;
      } else if (progress.mastered) {
        masteredCount++;
      } else {
        const lastReview = progress.lastReview ? new Date(progress.lastReview) : null;
        if (!lastReview) {
          learningCount++;
        } else {
          const daysSinceReview = Math.floor((today - lastReview) / (1000 * 60 * 60 * 24));
          if (daysSinceReview >= progress.interval) {
            reviewCount++;
          } else {
            learningCount++;
          }
        }
      }
    });
    
    setStats({
      new: newCount,
      learning: learningCount,
      review: reviewCount,
      mastered: masteredCount
    });
  }, [allCards, cardProgress]);

  useEffect(() => {
    if (seciliDers?.id) {
      fetchKonular();
      loadFlashCards();
    }
  }, [seciliDers]);

  useEffect(() => {
    if (seciliDers?.id) {
      loadFlashCards();
    }
  }, [seciliKonuId]);

  const fetchKonular = async () => {
    if (!seciliDers?.id) return;
    try {
      setLoadingKonular(true);
      const { data } = await api.get("/api/konu", {
        params: { dersId: seciliDers.id },
      });
      setKonular(data || []);
    } catch (e) {
      console.error("Konular alınamadı:", e);
    } finally {
      setLoadingKonular(false);
    }
  };

  const loadFlashCards = async () => {
    if (!seciliDers?.id) return;
    
    setLoading(true);
    setError(null);
    setAllCards([]);
    setCurrentCard(null);

    try {
      const params = { 
        dersId: Number(seciliDers.id), 
        limit: 200,
        excludeDenemeSinavi: true 
      };
      
      if (seciliKonuId) {
        params.konuId = Number(seciliKonuId);
      }

      const { data } = await api.get("/api/sorular", { params });

      // Deneme sınavı sorularını filtrele
      const normalSorular = (data || []).filter(s => {
        const denemeAdi = s.denemeAdi || s.deneme_adi || s.denemeAd || s.deneme_ad;
        if (denemeAdi) return false;
        if (s.denemeSinaviId || s.deneme_sinavi_id) return false;
        if (s.denemeSinavi || s.deneme_sinavi) return false;
        if (s.aciklama && typeof s.aciklama === 'string' && s.aciklama.includes('[Deneme')) return false;
        if (s.aciklama && typeof s.aciklama === 'string' && /deneme/i.test(s.aciklama)) return false;
        if (s.isDenemeSoru === true || s.is_deneme_soru === true) return false;
        return true;
      });

      // Soruları flashcard formatına dönüştür
      const flashCards = normalSorular
        .filter(soru => {
          const secenekler = soru.secenekler || [];
          const dogruSecenek = secenekler.find(s => s.dogru === true || s.dogru === 1);
          return secenekler.length >= 2 && dogruSecenek && soru.metin;
        })
        .map(soru => {
          const secenekler = soru.secenekler || [];
          const dogruSecenek = secenekler.find(s => s.dogru === true || s.dogru === 1);
          
          return {
            soruMetni: soru.metin,
            secenekler: secenekler.map(s => s.metin || s.label || "").filter(s => s),
            dogruSecenek: dogruSecenek?.metin || dogruSecenek?.label || "",
            soruId: soru.id,
            konuId: soru.konuId || soru.konu_id,
            aciklama: soru.aciklama || ""
          };
        })
        .filter(card => card.secenekler.length >= 2 && card.dogruSecenek);

      if (flashCards.length === 0) {
        setError("Bu filtrede flashcard için uygun soru bulunamadı.");
      } else {
        setAllCards(flashCards);
        // İlk tekrar edilecek kartı seç
        selectNextCard(flashCards);
      }
    } catch (e) {
      console.error("Sorular alınamadı:", e);
      setError("Sorular yüklenirken bir hata oluştu: " + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const selectNextCard = (cards = allCards) => {
    if (cards.length === 0) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Önce tekrar edilecek kartları kontrol et
    const reviewCardsList = cards.filter(card => {
      const progress = cardProgress[card.soruId];
      if (!progress || progress.mastered) return false;
      
      const lastReview = progress.lastReview ? new Date(progress.lastReview) : null;
      if (!lastReview) return false;
      
      const daysSinceReview = Math.floor((today - lastReview) / (1000 * 60 * 60 * 24));
      return daysSinceReview >= progress.interval;
    });
    
    if (reviewCardsList.length > 0) {
      // Rastgele bir tekrar kartı seç
      const randomIndex = Math.floor(Math.random() * reviewCardsList.length);
      setCurrentCard(reviewCardsList[randomIndex]);
      return;
    }
    
    // Tekrar edilecek kart yoksa, yeni kart seç
    const newCards = cards.filter(card => !cardProgress[card.soruId]);
    if (newCards.length > 0) {
      const randomIndex = Math.floor(Math.random() * newCards.length);
      setCurrentCard(newCards[randomIndex]);
      return;
    }
    
    // Hiç yeni kart yoksa, ilk kartı göster
    setCurrentCard(cards[0]);
  };

  const saveProgress = (soruId, quality) => {
    // Quality: 0=çok zor, 1=zor, 2=orta, 3=kolay, 4=çok kolay
    const progress = cardProgress[soruId] || {
      easeFactor: SM2_ALGORITHM.INITIAL_EASE,
      repetitions: 0,
      interval: 1,
      lastReview: null,
      mastered: false
    };
    
    const newEase = SM2_ALGORITHM.updateEaseFactor(progress.easeFactor, quality);
    let newRepetitions = progress.repetitions;
    let newInterval = progress.interval;
    let mastered = progress.mastered;
    
    if (quality >= 3) {
      // Doğru cevap
      newRepetitions += 1;
      newInterval = SM2_ALGORITHM.calculateNextInterval(newRepetitions, newEase, quality);
      
      // 5 kez doğru cevaplandıysa öğrenilmiş say
      if (newRepetitions >= 5) {
        mastered = true;
      }
    } else {
      // Yanlış cevap - baştan başla
      newRepetitions = 0;
      newInterval = 1;
      mastered = false;
    }
    
    const updatedProgress = {
      ...progress,
      easeFactor: newEase,
      repetitions: newRepetitions,
      interval: newInterval,
      lastReview: new Date().toISOString(),
      mastered: mastered
    };
    
    const newCardProgress = {
      ...cardProgress,
      [soruId]: updatedProgress
    };
    
    setCardProgress(newCardProgress);
    localStorage.setItem("flashcardProgress", JSON.stringify(newCardProgress));
  };

  const handleAnswer = (quality) => {
    if (!currentCard) return;
    
    saveProgress(currentCard.soruId, quality);
    
    // Kısa bir gecikme sonra sonraki karta geç
    setTimeout(() => {
      setSelected(null);
      setShowAnswer(false);
      selectNextCard();
    }, 800);
  };

  const selectOption = (option) => {
    if (selected || showAnswer) return;
    
    const isCorrect = option === currentCard.dogruSecenek;
    setSelected(option);
    setShowAnswer(true);
    
    // Cevap kalitesini belirle (basit versiyon - daha sonra kullanıcı geri bildirimi eklenebilir)
    const quality = isCorrect ? 4 : 1; // Doğru = çok kolay, Yanlış = zor
    
    setTimeout(() => {
      handleAnswer(quality);
    }, 1500);
  };

  const handleDifficultyFeedback = (difficulty) => {
    // Kullanıcı zorluk seviyesi belirtti
    // 0=çok zor, 1=zor, 2=orta, 3=kolay, 4=çok kolay
    handleAnswer(difficulty);
  };

  if (loading) {
    return (
      <div className="flash-container">
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flash-container">
        <h2 className="flash-title">📘 FlashCard</h2>
        <div className="flash-error">{error}</div>
        <button className="flash-back" onClick={onBack}>
          ◀ Geri
        </button>
      </div>
    );
  }

  if (!allCards.length) {
    return (
      <div className="flash-container">
        <h2 className="flash-title">📘 FlashCard</h2>
        <div className="flash-error">Bu filtrede soru bulunamadı.</div>
        <button className="flash-back" onClick={onBack}>
          ◀ Geri
        </button>
      </div>
    );
  }

  if (!currentCard) {
    selectNextCard();
    return <div className="loading">Kart seçiliyor...</div>;
  }

  const progress = cardProgress[currentCard.soruId];
  const isNew = !progress;
  const nextReview = progress?.lastReview 
    ? new Date(new Date(progress.lastReview).getTime() + progress.interval * 24 * 60 * 60 * 1000)
    : null;

  return (
    <div className="flash-container">
      <div className="flash-header">
        <h2 className="flash-title">📘 FlashCard</h2>
        <button className="flash-back-btn" onClick={onBack}>
          ◀ Geri
        </button>
      </div>
      
      {/* İstatistikler */}
      <div className="flash-stats">
        <div className="stat-item stat-new">
          <div className="stat-value">{stats.new}</div>
          <div className="stat-label">Yeni</div>
        </div>
        <div className="stat-item stat-learning">
          <div className="stat-value">{stats.learning}</div>
          <div className="stat-label">Öğreniliyor</div>
        </div>
        <div className="stat-item stat-review">
          <div className="stat-value">{stats.review}</div>
          <div className="stat-label">Tekrar</div>
        </div>
        <div className="stat-item stat-mastered">
          <div className="stat-value">{stats.mastered}</div>
          <div className="stat-label">Öğrenildi</div>
        </div>
      </div>

      {/* Konu Seçimi */}
      {konular.length > 0 && (
        <div className="flash-filter">
          <select 
            value={seciliKonuId} 
            onChange={(e) => setSeciliKonuId(e.target.value)}
            className="flash-select"
          >
            <option value="">📖 Tüm Konular</option>
            {konular.map((k) => (
              <option key={k.id} value={k.id}>{k.ad}</option>
            ))}
          </select>
        </div>
      )}

      {/* Kart Bilgisi */}
      <div className="flash-card-info">
        {isNew ? (
          <span className="card-badge card-new">🆕 Yeni Kart</span>
        ) : progress.mastered ? (
          <span className="card-badge card-mastered">✅ Öğrenildi</span>
        ) : (
          <>
            <span className="card-badge card-review">🔄 Tekrar</span>
            {nextReview && (
              <span className="card-next-review">
                Sonraki: {nextReview.toLocaleDateString("tr-TR")}
              </span>
            )}
          </>
        )}
        {progress && (
          <span className="card-progress">
            {progress.repetitions} tekrar • Zorluk: {progress.easeFactor.toFixed(2)}
          </span>
        )}
      </div>

      {/* FlashCard */}
      <div className="flash-card">
        <div className="flash-question">{currentCard.soruMetni}</div>
        
        {!showAnswer ? (
          <div className="options">
            {currentCard.secenekler.map((secenek, i) => (
              <button
                key={i}
                className="option"
                onClick={() => selectOption(secenek)}
                disabled={showAnswer}
              >
                {secenek}
              </button>
            ))}
          </div>
        ) : (
          <div className="flash-answer-section">
            <div className={`flash-answer ${selected === currentCard.dogruSecenek ? "correct" : "wrong"}`}>
              <div className="answer-label">
                {selected === currentCard.dogruSecenek ? "✅ Doğru!" : "❌ Yanlış"}
              </div>
              <div className="answer-text">
                Doğru Cevap: <strong>{currentCard.dogruSecenek}</strong>
              </div>
              {currentCard.aciklama && (
                <div className="answer-explanation">{currentCard.aciklama}</div>
              )}
            </div>
            
            {/* Zorluk Geri Bildirimi */}
            {selected === currentCard.dogruSecenek && (
              <div className="difficulty-feedback">
                <div className="difficulty-label">Bu soru size ne kadar kolay geldi?</div>
                <div className="difficulty-buttons">
                  <button 
                    className="difficulty-btn very-hard"
                    onClick={() => handleDifficultyFeedback(0)}
                  >
                    😰 Çok Zor
                  </button>
                  <button 
                    className="difficulty-btn hard"
                    onClick={() => handleDifficultyFeedback(1)}
                  >
                    😓 Zor
                  </button>
                  <button 
                    className="difficulty-btn medium"
                    onClick={() => handleDifficultyFeedback(2)}
                  >
                    😐 Orta
                  </button>
                  <button 
                    className="difficulty-btn easy"
                    onClick={() => handleDifficultyFeedback(3)}
                  >
                    😊 Kolay
                  </button>
                  <button 
                    className="difficulty-btn very-easy"
                    onClick={() => handleDifficultyFeedback(4)}
                  >
                    😎 Çok Kolay
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigasyon */}
      <div className="flash-navigation">
        <button 
          className="flash-nav-btn"
          onClick={() => {
            setSelected(null);
            setShowAnswer(false);
            selectNextCard();
          }}
        >
          ⏭️ Sonraki Kart
        </button>
      </div>
    </div>
  );
}
