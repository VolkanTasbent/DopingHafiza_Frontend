import { useEffect, useState, useRef, useMemo } from "react";
import api, { fileUrl } from "./services/api";
import { submitQuiz } from "./services/quiz";
import "./SoruCoz.css";

export default function DenemeSinavlari({ onBack }) {
  const [denemeListesi, setDenemeListesi] = useState({
    "TYT Denemeleri": [],
    "AYT Denemeleri": [],
    "Diğer": []
  });
  const [seciliDeneme, setSeciliDeneme] = useState(null);
  const [sorular, setSorular] = useState([]);
  const [step, setStep] = useState("select"); // select -> ready -> running -> result
  const [current, setCurrent] = useState(0);
  const [secimler, setSecimler] = useState({});
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);
  const [msg, setMsg] = useState("");
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [result, setResult] = useState(null);

  const errText = (e) =>
    e?.response?.data?.message || e?.response?.data?.error || e?.response?.data || e?.message || "Hata";

  const sureStr = useMemo(() => {
    const s = Math.floor(elapsedMs / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [elapsedMs]);

  useEffect(() => {
    fetchDenemeListesi();
  }, []);

  useEffect(() => () => { stopTimer(); }, []);

  // Deneme adından kategoriyi belirle (TYT veya AYT)
  function getKategori(denemeAdi) {
    if (!denemeAdi) return "Diğer";
    const adi = denemeAdi.toUpperCase();
    if (adi.includes("TYT") || adi.includes("TÜRKÇE MATEMATİK")) {
      return "TYT Denemeleri";
    } else if (adi.includes("AYT") || adi.includes("ALAN YETERLİLİK")) {
      return "AYT Denemeleri";
    }
    return "Diğer";
  }

  async function fetchDenemeListesi() {
    try {
      // Backend API: GET /api/deneme-sinavi (tekil)
      let denemeler = [];
      try {
        const { data } = await api.get("/api/deneme-sinavi");
        denemeler = Array.isArray(data) ? data : [];
      } catch (e) {
        console.warn("Deneme sınavı listesi alınamadı, sorular üzerinden denenecek:", e);
      }

      // Eğer deneme_sinavi tablosu boşsa veya hata varsa, sorulardan parse et (fallback)
      if (denemeler.length === 0) {
        const { data: tumSorular } = await api.get("/api/sorular", { params: { limit: 1000 } });
        const denemeGruplari = {};
        tumSorular.forEach(soru => {
          const denemeAdi = soru.denemeAdi || soru.deneme_adi || 
                           (soru.aciklama && soru.aciklama.match(/\[Deneme[^\]]+\]/)?.[0]?.replace(/[\[\]]/g, ''));
          if (denemeAdi) {
            if (!denemeGruplari[denemeAdi]) {
              denemeGruplari[denemeAdi] = [];
            }
            denemeGruplari[denemeAdi].push(soru);
          }
        });
        
        // Grupları deneme listesine çevir
        denemeler = Object.keys(denemeGruplari).map(adi => ({
          id: null,
          adi: adi,
          kategori: getKategori(adi),
          sorular: denemeGruplari[adi]
        }));
      } else {
        // Her deneme için sorularını çek
        for (const deneme of denemeler) {
          try {
            const denemeId = deneme.id || deneme.deneme_sinavi_id;
            console.log(`Deneme ${deneme.adi} (ID: ${denemeId}) için sorular çekiliyor...`);
            
            let sorular = [];
            
            // Önce özel endpoint'i dene: GET /api/deneme-sinavlari/{denemeId}/sorular
            try {
              const { data } = await api.get(`/api/deneme-sinavlari/${denemeId}/sorular`);
              sorular = Array.isArray(data) ? data : [];
              console.log(`Deneme ${deneme.adi} için özel endpoint'ten ${sorular.length} soru bulundu`);
            } catch (e1) {
              console.log(`Özel endpoint çalışmadı, standart endpoint deneniyor...`);
              // Özel endpoint çalışmazsa standart endpoint'i dene
              try {
                const { data } = await api.get("/api/sorular", { 
                  params: { denemeSinaviId: denemeId, limit: 1000 } 
                });
                sorular = Array.isArray(data) ? data : [];
                console.log(`Deneme ${deneme.adi} için standart endpoint'ten ${sorular.length} soru bulundu`);
              } catch (e2) {
                console.error(`Standart endpoint de çalışmadı:`, e2);
                // Son çare: tüm soruları çek ve filtrele
                try {
                  const { data: tumSorular } = await api.get("/api/sorular", { params: { limit: 1000 } });
                  sorular = Array.isArray(tumSorular) ? tumSorular.filter(s => 
                    (s.denemeSinaviId || s.deneme_sinavi_id) === denemeId
                  ) : [];
                  console.log(`Deneme ${deneme.adi} için filtreleme ile ${sorular.length} soru bulundu`);
                } catch (e3) {
                  console.error(`Tüm sorular çekilemedi:`, e3);
                }
              }
            }
            
            console.log(`Deneme ${deneme.adi} için toplam ${sorular.length} soru bulundu`);
            deneme.sorular = sorular || [];
            deneme.soruSayisi = deneme.sorular.length;
          } catch (e) {
            console.error(`Deneme ${deneme.adi} soruları alınamadı:`, e);
            deneme.sorular = [];
            deneme.soruSayisi = 0;
          }
        }
      }

      // Denemeleri kategorilere göre grupla
      const kategoriler = {
        "TYT Denemeleri": [],
        "AYT Denemeleri": [],
        "Diğer": []
      };

      denemeler.forEach(deneme => {
        const kategori = deneme.kategori ? 
          (deneme.kategori === "TYT" ? "TYT Denemeleri" : 
           deneme.kategori === "AYT" ? "AYT Denemeleri" : "Diğer") :
          getKategori(deneme.adi || deneme.deneme_adi);
        
        kategoriler[kategori].push({
          adi: deneme.adi || deneme.deneme_adi,
          soruSayisi: deneme.sorular ? deneme.sorular.length : 0,
          sorular: deneme.sorular || []
        });
      });

      // Her kategorideki denemeleri sırala
      Object.keys(kategoriler).forEach(kategori => {
        kategoriler[kategori].sort((a, b) => a.adi.localeCompare(b.adi));
      });

      setDenemeListesi(kategoriler);
    } catch (e) {
      setMsg("Deneme sınavları alınamadı: " + errText(e));
    }
  }

  function startDeneme(deneme) {
    setSeciliDeneme(deneme);
    setSorular(deneme.sorular);
    setSecimler({});
    setCurrent(0);
    setStep("ready");
  }

  function startTimer() {
    startedAtRef.current = new Date();
    setElapsedMs(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current.getTime());
    }, 250);
  }

  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function startTest() {
    setStep("running");
    startTimer();
  }

  function choose(soruId, secenekId) {
    setSecimler((prev) => ({ ...prev, [soruId]: secenekId }));
  }

  function clearAnswer(soruId) {
    setSecimler((prev) => {
      const next = { ...prev };
      delete next[soruId];
      return next;
    });
  }

  function toggleFlag(soruId) {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(soruId)) {
        newSet.delete(soruId);
      } else {
        newSet.add(soruId);
      }
      return newSet;
    });
  }

  function goToQuestion(index) {
    setCurrent(index);
  }

  async function submitTest() {
    try {
      stopTimer();
      const finishedAt = new Date();
      const items = sorular.map((q) => ({
        soruId: q.id,
        secenekId: secimler[q.id] ?? null,
      }));
      const payload = {
        items,
        startedAt: startedAtRef.current?.toISOString() ?? new Date().toISOString(),
        finishedAt: finishedAt.toISOString(),
      };
      const res = await submitQuiz(payload);
      setMsg("");
      setStep("result");
      setResult(res);
    } catch (e) {
      setMsg("Gönderim başarısız: " + errText(e));
      setStep("ready");
    }
  }

  function SoruCardModern({ soru, soruNo, totalSoru, seciliId, isFlagged, onChoose, onClear, onToggleFlag }) {
    const secenekHarfleri = ['A', 'B', 'C', 'D', 'E'];
    
    return (
      <div className="soru-card-modern">
        <div className="soru-card-header">
          <div className="soru-number">
            <span>Soru {soruNo}</span>
            <span className="soru-badge">{soruNo} / {totalSoru}</span>
          </div>
          <div className="soru-actions">
            {seciliId && (
              <button
                type="button"
                className="clear-btn"
                onClick={() => onClear(soru.id)}
                title="Boş Bırak"
              >
                ⭕ Boş Bırak
              </button>
            )}
            <button
              type="button"
              className={`flag-btn ${isFlagged ? 'flagged' : ''}`}
              onClick={() => onToggleFlag(soru.id)}
              title={isFlagged ? "İşareti Kaldır" : "İşaretle"}
            >
              {isFlagged ? '🚩' : '⚐'}
            </button>
          </div>
        </div>

        {soru.konular?.length > 0 && (
          <div className="soru-konular">
            {soru.konular.map((k) => (
              <span key={k.id} className="konu-chip">
                {k.ad}
              </span>
            ))}
          </div>
        )}

        <div className="soru-metin">
          {soru.metin}
        </div>

        {soru.imageUrl && (
          <img 
            src={fileUrl(soru.imageUrl)} 
            alt="Soru görseli" 
            className="soru-image"
          />
        )}

        <div className="secenekler-grid">
          {(soru.secenekler || []).map((opt, index) => (
            <div key={opt.id} className="secenek-item">
              <input
                type="radio"
                id={`opt_${opt.id}`}
                name={`q_${soru.id}`}
                value={opt.id}
                checked={seciliId === opt.id}
                onChange={() => onChoose(soru.id, opt.id)}
                className="secenek-input"
              />
              <label htmlFor={`opt_${opt.id}`} className="secenek-label">
                <div className="secenek-radio"></div>
                <span className="secenek-letter">{secenekHarfleri[index] || opt.siralama}</span>
                <span className="secenek-text">{opt.metin}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sorucoz-container">
      <div className="sorucoz-wrapper">
        <div className="sorucoz-header">
          <div className="sorucoz-header-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {step !== "running" && (
                <button 
                  type="button" 
                  onClick={() => {
                    if (step === "select") {
                      onBack?.();
                    } else {
                      setStep("select");
                      setSeciliDeneme(null);
                      setSorular([]);
                      setSecimler({});
                      setCurrent(0);
                      setResult(null);
                    }
                  }}
                  className="nav-btn nav-btn-prev"
                  style={{ padding: '8px 16px' }}
                >
                  ← Geri
                </button>
              )}
              <h2 className="sorucoz-title">Deneme Sınavları</h2>
            </div>
            {step === "running" && (
              <div className="timer-display">
                <span className="timer-icon">⏱️</span>
                <span>{sureStr}</span>
              </div>
            )}
          </div>

          {msg && (
            <div style={{ 
              background: '#fef2f2', 
              color: '#dc2626', 
              padding: '12px 16px', 
              borderRadius: '8px', 
              marginBottom: '16px',
              borderLeft: '4px solid #dc2626'
            }}>
              {msg}
            </div>
          )}

          {step === "select" && (
            <div style={{ padding: '20px 0' }}>
              {denemeListesi["TYT Denemeleri"].length === 0 && 
               denemeListesi["AYT Denemeleri"].length === 0 && 
               denemeListesi["Diğer"].length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <p>Henüz deneme sınavı eklenmemiş</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  {/* TYT Denemeleri */}
                  {denemeListesi["TYT Denemeleri"].length > 0 && (
                    <div>
                      <h3 style={{ 
                        margin: '0 0 16px 0', 
                        fontSize: '20px', 
                        fontWeight: 600,
                        color: '#1f2937',
                        paddingBottom: '12px',
                        borderBottom: '2px solid #667eea'
                      }}>
                        TYT Denemeleri
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {denemeListesi["TYT Denemeleri"].map((deneme, idx) => (
                          <div 
                            key={`tyt-${idx}`}
                            onClick={() => startDeneme(deneme)}
                            style={{
                              padding: '20px',
                              background: 'white',
                              border: '2px solid #e5e7eb',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#667eea';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#e5e7eb';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                              {deneme.adi}
                            </h4>
                            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                              {deneme.soruSayisi} soru
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AYT Denemeleri */}
                  {denemeListesi["AYT Denemeleri"].length > 0 && (
                    <div>
                      <h3 style={{ 
                        margin: '0 0 16px 0', 
                        fontSize: '20px', 
                        fontWeight: 600,
                        color: '#1f2937',
                        paddingBottom: '12px',
                        borderBottom: '2px solid #764ba2'
                      }}>
                        AYT Denemeleri
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {denemeListesi["AYT Denemeleri"].map((deneme, idx) => (
                          <div 
                            key={`ayt-${idx}`}
                            onClick={() => startDeneme(deneme)}
                            style={{
                              padding: '20px',
                              background: 'white',
                              border: '2px solid #e5e7eb',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#764ba2';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#e5e7eb';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                              {deneme.adi}
                            </h4>
                            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                              {deneme.soruSayisi} soru
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Diğer Denemeler */}
                  {denemeListesi["Diğer"].length > 0 && (
                    <div>
                      <h3 style={{ 
                        margin: '0 0 16px 0', 
                        fontSize: '20px', 
                        fontWeight: 600,
                        color: '#1f2937',
                        paddingBottom: '12px',
                        borderBottom: '2px solid #9ca3af'
                      }}>
                        Diğer Denemeler
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {denemeListesi["Diğer"].map((deneme, idx) => (
                          <div 
                            key={`other-${idx}`}
                            onClick={() => startDeneme(deneme)}
                            style={{
                              padding: '20px',
                              background: 'white',
                              border: '2px solid #e5e7eb',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#9ca3af';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#e5e7eb';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                              {deneme.adi}
                            </h4>
                            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                              {deneme.soruSayisi} soru
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* İlerleme Çubuğu */}
          {step === "running" && sorular.length > 0 && (
            <div className="progress-section">
              <div className="progress-info">
                <span className="progress-text">
                  İlerleme: {current + 1} / {sorular.length}
                </span>
                <div className="progress-stats">
                  <span className="progress-stat">
                    <span>✅</span> {Object.keys(secimler).length} Cevaplanan
                  </span>
                  <span className="progress-stat">
                    <span>⭕</span> {sorular.filter(s => secimler[s.id] === undefined).length} Boş
                  </span>
                  <span className="progress-stat">
                    <span>🚩</span> {flaggedQuestions.size} İşaretli
                  </span>
                </div>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${((current + 1) / sorular.length) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Ready State */}
        {step === "ready" && sorular.length > 0 && (
          <div className="ready-state">
            <div className="ready-icon">🎯</div>
            <h3>{seciliDeneme?.adi || 'Deneme Sınavı'}</h3>
            <p>
              <b>{sorular.length}</b> soru seni bekliyor
            </p>
            <button type="button" onClick={startTest} className="start-test-btn">
              🚀 Teste Başla
            </button>
          </div>
        )}

        {step === "running" && sorular.length > 0 && (
          <>
            {/* Soru Navigator */}
            <div className="soru-navigator">
              <div className="navigator-title">Sorular</div>
              <div className="navigator-grid">
                {sorular.map((_, index) => {
                  const soruId = sorular[index].id;
                  const isAnswered = secimler[soruId] !== undefined;
                  const isEmpty = !isAnswered;
                  
                  return (
                    <button
                      key={index}
                      className={`navigator-item ${
                        index === current ? 'current' : ''
                      } ${isAnswered ? 'answered' : isEmpty ? '' : ''} ${
                        flaggedQuestions.has(soruId) ? 'flagged' : ''
                      }`}
                      onClick={() => goToQuestion(index)}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Soru Kartı */}

            <SoruCardModern
              soru={sorular[current]}
              soruNo={current + 1}
              totalSoru={sorular.length}
              seciliId={secimler[sorular[current].id] ?? null}
              isFlagged={flaggedQuestions.has(sorular[current].id)}
              onChoose={choose}
              onClear={clearAnswer}
              onToggleFlag={toggleFlag}
            />

            {/* Navigation */}
            <div className="soru-navigation">
              <button 
                type="button" 
                onClick={() => setCurrent((i) => Math.max(0, i - 1))} 
                disabled={current === 0}
                className="nav-btn nav-btn-prev"
              >
                ◀ Önceki
              </button>
              
              <button
                type="button"
                onClick={() => setCurrent((i) => Math.min(sorular.length - 1, i + 1))}
                disabled={current === sorular.length - 1}
                className="nav-btn nav-btn-next"
              >
                Sonraki ▶
              </button>
              
              <button 
                type="button" 
                onClick={submitTest}
                className="nav-btn nav-btn-submit"
              >
                ✓ Testi Bitir
              </button>
            </div>
          </>
        )}

        {step === "result" && result && (() => {
          const dogru = result.correct ?? 0;
          const yanlis = result.wrong ?? 0;
          const toplam = result.total ?? 0;
          const bos = toplam - dogru - yanlis;
          const net = (dogru - (yanlis / 4)).toFixed(2);
          
          return (
            <div className="result-state">
              <div className="result-header">
                <h2 className="result-title">Test Tamamlandı!</h2>
                <p className="result-subtitle">
                  {result.correct / result.total >= 0.7 
                    ? 'Harika bir performans!'
                    : result.correct / result.total >= 0.4
                    ? 'İyi bir başlangıç! Devam et!'
                    : 'Çalışmaya devam et! Sen yaparsın!'}
                </p>
              </div>

              <div className="result-stats">
                <div className="result-stat-card">
                  <div className="result-stat-value">{dogru}</div>
                  <div className="result-stat-label">Doğru</div>
                </div>
                <div className="result-stat-card">
                  <div className="result-stat-value">{yanlis}</div>
                  <div className="result-stat-label">Yanlış</div>
                </div>
                <div className="result-stat-card">
                  <div className="result-stat-value">{bos}</div>
                  <div className="result-stat-label">Boş</div>
                </div>
                <div className="result-stat-card highlight">
                  <div className="result-stat-value">{net}</div>
                  <div className="result-stat-label">Net</div>
                </div>
                <div className="result-stat-card">
                  <div className="result-stat-value">{toplam}</div>
                  <div className="result-stat-label">Soru Sayısı</div>
                </div>
              </div>

              <div className="result-actions">
                <button
                  type="button"
                  onClick={() => {
                    setStep("select");
                    setSorular([]);
                    setSecimler({});
                    setFlaggedQuestions(new Set());
                    setCurrent(0);
                    setResult(null);
                  }}
                  className="new-test-btn"
                >
                  Yeni Test Başlat
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

