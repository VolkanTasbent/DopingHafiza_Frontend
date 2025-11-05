// src/RaporDetay.jsx
import React, { useEffect, useState } from "react";
import api, { fileUrl } from "./services/api";
import "./Raporlarim.css";

export default function RaporDetay({ oturumId, onBack }) {
  const [tumSorular, setTumSorular] = useState([]);
  const [detayVeri, setDetayVeri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [sadeceyanlisGoster, setSadeceYanlisGoster] = useState(true);

  const errText = (e) =>
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    (typeof e?.response?.data === "string" ? e.response.data : "") ||
    e?.message ||
    "Hata";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    loadDetay();
  }, [oturumId]);

  useEffect(() => {
    if (tumSorular.length > 0) {
      const yanlislar = tumSorular.filter(item => {
        if (!item.soru || !item.soru.secenekler || !Array.isArray(item.soru.secenekler)) return false;
        
        const secenekId = item.secenekId;
        let secilen = item.soru.secenekler.find(s => s.id === secenekId);
        
        // Eğer ID ile bulunamazsa ve secenekId bir sayı ise (index + 1 formatında), index ile bul
        if (!secilen && secenekId && (typeof secenekId === 'number' || /^\d+$/.test(String(secenekId)))) {
          const index = typeof secenekId === 'number' ? secenekId - 1 : parseInt(secenekId, 10) - 1;
          if (index >= 0 && index < item.soru.secenekler.length) {
            secilen = item.soru.secenekler[index];
          }
        }
        
        const dogru = item.soru.secenekler.find(s => s.dogru === true || s.dogru === 1);
        
        // Eğer seçenek ID'leri null ise, index karşılaştırması yap
        if (!secilen || !dogru) return false;
        if (secilen.id === null && dogru.id === null) {
          return item.soru.secenekler.indexOf(secilen) !== item.soru.secenekler.indexOf(dogru);
        }
        
        return secilen.id !== dogru.id;
      });
      
      setDetayVeri(sadeceyanlisGoster ? yanlislar : tumSorular);
    }
  }, [sadeceyanlisGoster, tumSorular]);

  const loadDetay = async () => {
    try {
      setLoading(true);
      setMsg("");
      
      const { data } = await api.get(`/api/raporlar/${oturumId}/detay`);
      const tumItems = data?.items || [];
      
      const yanlislar = tumItems.filter(item => {
        if (!item.soru || !item.soru.secenekler || !Array.isArray(item.soru.secenekler)) {
          return false;
        }
        
        const secenekId = item.secenekId;
        let secilen = item.soru.secenekler.find(s => s.id === secenekId);
        
        // Eğer ID ile bulunamazsa ve secenekId bir sayı ise (index + 1 formatında), index ile bul
        if (!secilen && secenekId && (typeof secenekId === 'number' || /^\d+$/.test(String(secenekId)))) {
          const index = typeof secenekId === 'number' ? secenekId - 1 : parseInt(secenekId, 10) - 1;
          if (index >= 0 && index < item.soru.secenekler.length) {
            secilen = item.soru.secenekler[index];
          }
        }
        
        const dogru = item.soru.secenekler.find(s => s.dogru === true || s.dogru === 1);
        
        // Eğer seçenek ID'leri null ise, index karşılaştırması yap
        if (!secilen || !dogru) return false;
        if (secilen.id === null && dogru.id === null) {
          return item.soru.secenekler.indexOf(secilen) !== item.soru.secenekler.indexOf(dogru);
        }
        
        return secilen.id !== dogru.id;
      });
      
      setTumSorular(tumItems);
      setDetayVeri(sadeceyanlisGoster ? yanlislar : tumItems);
    } catch (e) {
      console.error("Detay hatası:", e);
      setMsg("Detay alınamadı: " + errText(e));
    } finally {
      setLoading(false);
    }
  };

  const yanlisSayisi = tumSorular.filter(item => {
    if (!item.soru || !item.soru.secenekler || !Array.isArray(item.soru.secenekler)) return false;
    
    const secenekId = item.secenekId;
    let secilen = item.soru.secenekler.find(s => s.id === secenekId);
    
    // Eğer ID ile bulunamazsa ve secenekId bir sayı ise (index + 1 formatında), index ile bul
    if (!secilen && secenekId && (typeof secenekId === 'number' || /^\d+$/.test(String(secenekId)))) {
      const index = typeof secenekId === 'number' ? secenekId - 1 : parseInt(secenekId, 10) - 1;
      if (index >= 0 && index < item.soru.secenekler.length) {
        secilen = item.soru.secenekler[index];
      }
    }
    
    const dogru = item.soru.secenekler.find(s => s.dogru === true || s.dogru === 1);
    
    // Eğer seçenek ID'leri null ise, index karşılaştırması yap
    if (!secilen || !dogru) return false;
    if (secilen.id === null && dogru.id === null) {
      return item.soru.secenekler.indexOf(secilen) !== item.soru.secenekler.indexOf(dogru);
    }
    
    return secilen.id !== dogru.id;
  }).length;

  return (
    <div className="rapor-detay-container">
      <div className="rapor-detay-header">
        <div className="detay-header-content">
          <h1 className="detay-main-title">Test Detayları</h1>
          <p className="detay-subtitle-text">Soruları detaylı olarak inceleyin ve öğrenin</p>
        </div>
        <button type="button" onClick={onBack} className="detay-back-button">
          Geri Dön
        </button>
      </div>

      {msg && (
        <div className="error-message-banner">
          <span className="error-icon-circle">!</span>
          <span>{msg}</span>
        </div>
      )}

      {!loading && tumSorular.length > 0 && (
        <div className="filter-buttons-container">
          <button
            onClick={() => setSadeceYanlisGoster(false)}
            className={`filter-btn ${!sadeceyanlisGoster ? 'active' : ''}`}
          >
            Tüm Sorular <span className="badge-count">({tumSorular.length})</span>
          </button>
          <button
            onClick={() => setSadeceYanlisGoster(true)}
            className={`filter-btn filter-btn-danger ${sadeceyanlisGoster ? 'active' : ''}`}
          >
            Yanlış Cevaplar <span className="badge-count">({yanlisSayisi})</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-container-detay">
          <div className="loading-spinner-large"></div>
          <p className="loading-text">Detaylar yükleniyor...</p>
        </div>
      ) : detayVeri.length === 0 && sadeceyanlisGoster ? (
        <div className="empty-state-success">
          <div className="success-icon-box">
            <div className="check-mark"></div>
          </div>
          <h3 className="empty-title">Mükemmel!</h3>
          <p className="empty-text">Bu testte tüm soruları doğru cevapladınız</p>
          <button onClick={onBack} className="back-button-primary">
            Raporlara Dön
          </button>
        </div>
      ) : (
        <>
          {sadeceyanlisGoster && yanlisSayisi > 0 && (
            <div className="stats-summary-banner">
              <div className="summary-card error-card">
                <div className="summary-icon error-icon"></div>
                <div className="summary-content">
                  <div className="summary-value">{yanlisSayisi}</div>
                  <div className="summary-label">Yanlış Cevap</div>
                </div>
              </div>
            </div>
          )}

          <div className="soru-detay-listesi">
            {detayVeri.map((it, i) => {
              const s = it.soru;
              const chosenId = it.secenekId;
              
              // Deneme sınavı soruları için özel mantık: seçenek ID'leri null olabilir
              // Bu durumda seçenek sırasını (index) kullan
              let chosen = null;
              let correct = null;
              
              if (s?.secenekler && Array.isArray(s.secenekler)) {
                // Önce ID ile eşleştirme dene
                chosen = s.secenekler.find(x => x.id === chosenId);
                correct = s.secenekler.find(x => x.dogru === true || x.dogru === 1);
                
                // Eğer ID ile bulunamazsa ve chosenId bir sayı ise (index + 1 formatında), index ile bul
                if (!chosen && chosenId !== null && chosenId !== undefined) {
                  if (typeof chosenId === 'number' || /^\d+$/.test(String(chosenId))) {
                    const index = typeof chosenId === 'number' ? chosenId - 1 : parseInt(chosenId, 10) - 1;
                    if (index >= 0 && index < s.secenekler.length) {
                      chosen = s.secenekler[index];
                    }
                  }
                }
                
                // Doğru cevabı bul (eğer hala bulunamadıysa)
                if (!correct) {
                  correct = s.secenekler.find(x => x.dogru === true || x.dogru === 1);
                }
              }
              
              const isBlank = !chosen || chosenId === null || chosenId === undefined;
              
              // Doğru cevap kontrolü: seçenek ID'leri null ise index karşılaştırması yap
              let isCorrect = false;
              if (!isBlank && chosen && correct) {
                // Seçeneklerin ID'leri null mu kontrol et
                const chosenHasNullId = chosen.id === null || chosen.id === undefined;
                const correctHasNullId = correct.id === null || correct.id === undefined;
                
                if (!chosenHasNullId && !correctHasNullId) {
                  // Normal sorular: ID karşılaştırması
                  isCorrect = chosen.id === correct.id;
                } else {
                  // Deneme sınavı soruları: index karşılaştırması
                  const chosenIndex = s.secenekler.indexOf(chosen);
                  const correctIndex = s.secenekler.indexOf(correct);
                  isCorrect = chosenIndex === correctIndex && chosenIndex !== -1;
                }
              }
              
              // Debug: İlk 3 soru için detaylı log
              if (i < 3 && detayVeri.length > 0 && s?.secenekler) {
                console.log(`RaporDetay - Soru ${i + 1} analizi:`, {
                  soruId: s?.id,
                  chosenId: chosenId,
                  chosenIdType: typeof chosenId,
                  chosen: chosen ? { 
                    index: s.secenekler.indexOf(chosen), 
                    metin: chosen.metin?.substring(0, 50), 
                    id: chosen.id 
                  } : null,
                  correct: correct ? { 
                    index: s.secenekler.indexOf(correct), 
                    metin: correct.metin?.substring(0, 50), 
                    id: correct.id,
                    dogru: correct.dogru
                  } : null,
                  isCorrect: isCorrect,
                  isBlank: isBlank,
                  secenekler: s.secenekler.map((sec, idx) => ({ 
                    index: idx, 
                    id: sec.id, 
                    metin: sec.metin?.substring(0, 30), 
                    dogru: sec.dogru 
                  }))
                });
              }
              
              // Video URL'ini bul - tüm olası alan adlarını kontrol et
              const videoUrl = s?.videoUrl || s?.video_url || s?.cozumUrl || s?.cozum_url || s?.cozumVideosuUrl || s?.cozum_videosu_url;
              
              return (
                <div key={it.id || i} className="soru-detay-modern-card">
                  <div className="soru-number-header">
                    <div className="soru-number-box">
                      <span className="soru-number-text">Soru {i + 1}</span>
                      <span className={`soru-status-badge ${isCorrect ? 'status-correct' : isBlank ? 'status-blank' : 'status-wrong'}`}>
                        {isCorrect ? 'Doğru' : isBlank ? 'Boş' : 'Yanlış'}
                      </span>
                    </div>
                    <div className="soru-tags-modern">
                      <span className="tag-modern tag-ders">{s?.dersAd || "-"}</span>
                      {Array.isArray(s?.konular) && s.konular.map((k) => (
                        <span key={k.id} className="tag-modern tag-konu">{k.ad}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="soru-metin-modern">
                    <div className="soru-metin-label">Soru Metni</div>
                    <div className="soru-metin-content">{s?.metin || "-"}</div>
                  </div>

                  <div className="cevap-karsilastirma-modern">
                    <div className={`cevap-kutu ${isCorrect ? 'cevap-dogru-kutu' : isBlank ? 'cevap-bos-kutu' : 'cevap-yanlis-kutu'}`}>
                      <div className="cevap-kutu-header">
                        <div className={`cevap-status-icon ${isCorrect ? 'icon-correct' : isBlank ? 'icon-blank' : 'icon-wrong'}`}></div>
                        <span className="cevap-kutu-title">Senin Cevabın</span>
                      </div>
                      <div className="cevap-kutu-content">
                        {isBlank ? (
                          <span className="cevap-bos-text">Bu soruyu boş bıraktınız</span>
                        ) : (
                          chosen?.metin || "-"
                        )}
                      </div>
                    </div>

                    {!isCorrect && (
                      <>
                        <div className="arrow-separator">→</div>
                        <div className="cevap-kutu cevap-dogru-kutu">
                          <div className="cevap-kutu-header">
                            <div className="cevap-status-icon icon-correct"></div>
                            <span className="cevap-kutu-title">Doğru Cevap</span>
                          </div>
                          <div className="cevap-kutu-content">{correct?.metin || "-"}</div>
                        </div>
                      </>
                    )}
                  </div>

                  {videoUrl ? (
                    <div className="soru-cozum-butonu-container">
                      <a
                        href={videoUrl.startsWith('/files/') ? fileUrl(videoUrl) : videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="soru-cozum-butonu"
                      >
                        <span className="cozum-icon">▶</span>
                        <span>Soru Çözümüne Git</span>
                      </a>
                    </div>
                  ) : (
                    <div style={{ 
                      marginTop: "20px", 
                      padding: "12px", 
                      background: "#fef3c7", 
                      borderRadius: "8px", 
                      fontSize: "13px", 
                      color: "#92400e",
                      textAlign: "center"
                    }}>
                      Bu soru için çözüm videosu henüz eklenmemiş
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="detay-footer-actions">
            <button onClick={onBack} className="back-button-primary">
              Raporlara Dön
            </button>
          </div>
        </>
      )}
    </div>
  );
}
