import { useEffect, useState } from "react";
import "./FlashCard.css";
import api from "./services/api";

export default function FlashCard({ onBack, seciliDers }) {
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [konular, setKonular] = useState([]);
  const [seciliKonuId, setSeciliKonuId] = useState("");
  const [loadingKonular, setLoadingKonular] = useState(false);

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
    setCards([]);
    setIndex(0);
    setSelected(null);
    setShowAnswer(false);

    try {
      const params = { 
        dersId: Number(seciliDers.id), 
        limit: 100,
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
          // En az 2 seçenek ve doğru cevap olmalı
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
            soruId: soru.id
          };
        })
        .filter(card => card.secenekler.length >= 2 && card.dogruSecenek);

      if (flashCards.length === 0) {
        setError("Bu filtrede flashcard için uygun soru bulunamadı.");
      } else {
        setCards(flashCards);
      }
    } catch (e) {
      console.error("Sorular alınamadı:", e);
      setError("Sorular yüklenirken bir hata oluştu: " + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const selectOption = (option) => {
    if (selected || showAnswer) return; // tekrar tıklamasın

    setSelected(option);
    setShowAnswer(true);

    setTimeout(() => {
      setSelected(null);
      setShowAnswer(false);

      if (index + 1 < cards.length) {
        setIndex(index + 1);
      } else {
        // Tüm sorular bitti, başa dön veya mesaj göster
        if (window.confirm("Tüm sorular bitti! Başa dönmek ister misiniz?")) {
          setIndex(0);
        }
      }
    }, 1500);
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
        <div style={{ 
          background: '#fef2f2', 
          color: '#dc2626', 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '16px' 
        }}>
          {error}
        </div>
        <button className="flash-back" onClick={onBack}>
          ◀ Geri
        </button>
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="flash-container">
        <h2 className="flash-title">📘 FlashCard</h2>
        <div style={{ 
          background: '#fef2f2', 
          color: '#dc2626', 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '16px' 
        }}>
          Bu filtrede soru bulunamadı.
        </div>
        <button className="flash-back" onClick={onBack}>
          ◀ Geri
        </button>
      </div>
    );
  }

  const card = cards[index];

  return (
    <div className="flash-container">
      <h2 className="flash-title">📘 FlashCard</h2>
      
      {/* Konu Seçimi */}
      {konular.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <select 
            value={seciliKonuId} 
            onChange={(e) => setSeciliKonuId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '14px',
              width: '100%',
              maxWidth: '300px'
            }}
          >
            <option value="">📖 Tüm Konular</option>
            {konular.map((k) => (
              <option key={k.id} value={k.id}>{k.ad}</option>
            ))}
          </select>
        </div>
      )}

      {/* İlerleme Göstergesi */}
      <div style={{ 
        marginBottom: '20px', 
        fontSize: '14px', 
        color: '#666',
        fontWeight: '500'
      }}>
        Soru {index + 1} / {cards.length}
      </div>

      <div className="flash-question">{card.soruMetni}</div>

      <div className="options">
        {card.secenekler.map((secenek, i) => (
          <button
            key={i}
            className={
              showAnswer
                ? secenek === card.dogruSecenek
                  ? "option correct"
                  : secenek === selected
                  ? "option wrong"
                  : "option"
                : "option"
            }
            onClick={() => selectOption(secenek)}
            disabled={showAnswer}
          >
            {secenek}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
        <button 
          className="flash-back" 
          onClick={() => {
            if (index > 0) {
              setIndex(index - 1);
              setSelected(null);
              setShowAnswer(false);
            }
          }}
          disabled={index === 0}
          style={{ opacity: index === 0 ? 0.5 : 1 }}
        >
          ◀ Önceki
        </button>
        <button 
          className="flash-back" 
          onClick={() => {
            if (index < cards.length - 1) {
              setIndex(index + 1);
              setSelected(null);
              setShowAnswer(false);
            }
          }}
          disabled={index === cards.length - 1}
          style={{ opacity: index === cards.length - 1 ? 0.5 : 1 }}
        >
          Sonraki ▶
        </button>
      </div>

      <button className="flash-back" onClick={onBack} style={{ marginTop: '10px' }}>
        ◀ Geri
      </button>
    </div>
  );
}
