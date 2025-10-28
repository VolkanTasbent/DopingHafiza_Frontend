// src/RaporDetay.jsx
import React, { useEffect, useState } from "react";
import api from "./services/api";
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
    // Sayfa yüklendiğinde en üste scroll et
    window.scrollTo({ top: 0, behavior: 'auto' });
    
    loadDetay();
  }, [oturumId]);

  useEffect(() => {
    // Toggle değiştiğinde filtreleme yap
    if (tumSorular.length > 0) {
      const yanlislar = tumSorular.filter(item => {
        if (!item.soru || !item.soru.secenekler || !Array.isArray(item.soru.secenekler)) return false;
        const secilen = item.soru.secenekler.find(s => s.id === item.secenekId);
        const dogru = item.soru.secenekler.find(s => s.dogru === true || s.dogru === 1);
        return !secilen || secilen.id !== dogru?.id;
      });
      
      setDetayVeri(sadeceyanlisGoster ? yanlislar : tumSorular);
    }
  }, [sadeceyanlisGoster, tumSorular]);

  const loadDetay = async () => {
    try {
      setLoading(true);
      setMsg("");
      
      // Önce tüm detayları çek
      const { data } = await api.get(`/api/raporlar/${oturumId}/detay`);
      
      // Frontend'de sadece yanlışları filtrele
      const tumItems = data?.items || [];
      
      const yanlislar = tumItems.filter(item => {
        // Soru veya seçenekler yoksa atla (silinmiş sorular)
        if (!item.soru || !item.soru.secenekler || !Array.isArray(item.soru.secenekler)) {
          return false;
        }
        
        // Kullanıcının seçtiği şık
        const secilen = item.soru.secenekler.find(s => s.id === item.secenekId);
        
        // Doğru şık (eski ve yeni format desteği)
        const dogru = item.soru.secenekler.find(s => s.dogru === true || s.dogru === 1);
        
        // Eğer seçilen yok veya seçilen doğru değilse yanlış
        return !secilen || secilen.id !== dogru?.id;
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

  return (
    <div className="auth-container">
      <div className="auth-box detay-page">
        <div className="auth-header detay-header">
          <div>
            <h2 className="auth-title">🧠 Yanlış Yapılan Sorular</h2>
            <p className="detay-subtitle">Test oturumunu detaylı incele</p>
          </div>
          <button type="button" onClick={onBack} className="detay-back-btn">
            ← Raporlara Dön
          </button>
        </div>

        <div className="auth-form">
          {msg && <p className="error-msg">{msg}</p>}

          {!loading && tumSorular.length > 0 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '8px',
              marginBottom: '20px',
              background: '#f9fafb',
              padding: '12px',
              borderRadius: '12px',
              border: '2px solid #e5e7eb'
            }}>
              <button
                onClick={() => setSadeceYanlisGoster(false)}
                style={{
                  padding: '10px 20px',
                  background: !sadeceyanlisGoster ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                  color: !sadeceyanlisGoster ? 'white' : '#6b7280',
                  border: !sadeceyanlisGoster ? 'none' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                📚 Tüm Sorular ({tumSorular.length})
              </button>
              <button
                onClick={() => setSadeceYanlisGoster(true)}
                style={{
                  padding: '10px 20px',
                  background: sadeceyanlisGoster ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'white',
                  color: sadeceyanlisGoster ? 'white' : '#6b7280',
                  border: sadeceyanlisGoster ? 'none' : '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                ❌ Sadece Yanlışlar ({tumSorular.filter(item => {
                  if (!item.soru || !item.soru.secenekler || !Array.isArray(item.soru.secenekler)) return false;
                  const secilen = item.soru.secenekler.find(s => s.id === item.secenekId);
                  const dogru = item.soru.secenekler.find(s => s.dogru === true || s.dogru === 1);
                  return !secilen || secilen.id !== dogru?.id;
                }).length})
              </button>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Detaylar yükleniyor...</p>
            </div>
          ) : detayVeri.length === 0 && sadeceyanlisGoster ? (
            <div className="empty-state-page">
              <div className="empty-icon">🎉</div>
              <h3>Harika İş Çıkardın!</h3>
              <p>Bu testte tüm cevapların doğru</p>
              <button onClick={onBack} className="back-to-raporlar-btn">
                📊 Raporlara Dön
              </button>
            </div>
          ) : (
            <>
              {sadeceyanlisGoster && (
                <div className="detay-stats-banner">
                  <div className="detay-stat">
                    <span className="detay-stat-icon">❌</span>
                    <span className="detay-stat-value">{detayVeri.length}</span>
                    <span className="detay-stat-label">Yanlış Soru</span>
                  </div>
                </div>
              )}

              <div className="soru-listesi">
                {detayVeri.map((it, i) => {
                  const s = it.soru;
                  const chosenId = it.secenekId;
                  const chosen = (s?.secenekler || []).find(x => x.id === chosenId);
                  const correct = (s?.secenekler || []).find(x => x.dogru === true);
                  const isCorrect = chosen?.id === correct?.id;
                  
                  return (
                    <div key={it.id || i} className="soru-detay-card">
                      <div className="soru-header">
                        <span className="soru-no">
                          Soru {i + 1}
                          {isCorrect && <span style={{ marginLeft: '8px' }}>✅</span>}
                          {!isCorrect && <span style={{ marginLeft: '8px' }}>❌</span>}
                        </span>
                        <div className="soru-tags">
                          <span className="tag ders-tag">{s?.dersAd || "-"}</span>
                          {Array.isArray(s?.konular) && s.konular.map((k) => (
                            <span key={k.id} className="tag konu-tag">{k.ad}</span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="soru-metin">
                        <p>{s?.metin || "-"}</p>
                      </div>

                      <div className="cevap-karsilastirma">
                        <div className={`cevap-item ${
                          isCorrect ? 'dogru-cevap' : 
                          !chosen ? 'bos-cevap' : 
                          'yanlis-cevap'
                        }`}>
                          <div className="cevap-label">
                            <span className="icon">
                              {isCorrect ? '✅' : !chosen ? '⭕' : '❌'}
                            </span>
                            <span>Senin Cevabın</span>
                          </div>
                          <div className="cevap-text">
                            {chosen?.metin || <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Boş Bırakıldı</span>}
                          </div>
                        </div>

                        {!isCorrect && (
                          <>
                            <div className="cevap-arrow">→</div>
                            <div className="cevap-item dogru-cevap">
                              <div className="cevap-label">
                                <span className="icon">✅</span>
                                <span>Doğru Cevap</span>
                              </div>
                              <div className="cevap-text">{correct?.metin || "-"}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="detay-bottom-actions">
                <button onClick={onBack} className="back-to-raporlar-btn">
                  ← Raporlara Dön
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

