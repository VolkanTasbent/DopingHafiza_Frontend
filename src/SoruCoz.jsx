import { useEffect, useMemo, useRef, useState } from "react";
import api, { fileUrl } from "./services/api";
import { submitQuiz } from "./services/quiz";
import "./SoruCoz.css";

export default function SoruCoz({ onBack, seciliDers, me }) {
  // seçimler
  const [dersler, setDersler] = useState([]);
  const [seciliDersId, setSeciliDersId] = useState(seciliDers?.id?.toString() || "");
  const [konular, setKonular] = useState([]);
  const [seciliKonuId, setSeciliKonuId] = useState("");

  // test durumu
  const [sorular, setSorular] = useState([]);
  const [step, setStep] = useState("select"); // select -> ready -> running -> result
  const [current, setCurrent] = useState(0);
  const [secimler, setSecimler] = useState({});  // { [soruId]: secenekId }

  // zaman
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);

  const [msg, setMsg] = useState("");
  const [autoLoadTriggered, setAutoLoadTriggered] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());

  // --- helpers ---
  const errText = (e) =>
    e?.response?.data?.message || e?.response?.data?.error || e?.response?.data || e?.message || "Hata";

  const sureStr = useMemo(() => {
    const s = Math.floor(elapsedMs / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [elapsedMs]);

  // --- effects ---
  useEffect(() => { 
    fetchDersler(); 
  }, []);

  // Eğer dışarıdan seciliDers gelirse otomatik olarak seç
  useEffect(() => {
    if (seciliDers?.id && !autoLoadTriggered) {
      const dersIdStr = seciliDers.id.toString();
      setSeciliDersId(dersIdStr);
      setAutoLoadTriggered(true);
    }
  }, [seciliDers, autoLoadTriggered]);

  useEffect(() => {
    if (seciliDersId) {
      fetchKonular(seciliDersId);
      setSeciliKonuId("");
      setSorular([]);
      setStep("select");
      
      // Eğer otomatik yükleme tetiklendiyse, soruları da otomatik getir
      if (autoLoadTriggered && seciliDers?.id?.toString() === seciliDersId) {
        // Konular yüklendikten sonra soruları getir
        setTimeout(() => {
          autoGetirSorular(seciliDersId);
        }, 500);
      }
    } else {
      setKonular([]); setSorular([]); setStep("select");
    }
  }, [seciliDersId]);

  useEffect(() => () => { stopTimer(); }, []);

  // Otomatik soru getirme fonksiyonu
  async function autoGetirSorular(dersId) {
    try {
      const params = { dersId: Number(dersId), limit: 100 };
      // Deneme sınavı sorularını hariç tutmak için parametre ekle
      params.excludeDenemeSinavi = true;
      
      const { data } = await api.get("/api/sorular", { params });
      
      // Debug: İlk sorunun yapısını kontrol et
      if (data && data.length > 0) {
        console.log("AutoGetirSorular - Backend'den gelen ilk soru örneği:", {
          id: data[0].id,
          denemeAdi: data[0].denemeAdi,
          deneme_adi: data[0].deneme_adi,
          denemeSinaviId: data[0].denemeSinaviId,
          deneme_sinavi_id: data[0].deneme_sinavi_id,
          denemeSinavi: data[0].denemeSinavi,
          deneme_sinavi: data[0].deneme_sinavi,
          aciklama: data[0].aciklama,
          tümAlanlar: Object.keys(data[0])
        });
      }
      
      // Deneme sınavı sorularını filtrele - tüm olası alanları kontrol et
      const normalSorular = (data || []).filter(s => {
        // 1. Deneme adı kontrolü
        const denemeAdi = s.denemeAdi || s.deneme_adi || s.denemeAd || s.deneme_ad;
        if (denemeAdi) return false;
        
        // 2. Deneme sınavı ID kontrolü - tüm olası alan adları
        if (s.denemeSinaviId || s.deneme_sinavi_id || s.denemeSinaviId || s.deneme_sinavi_Id) return false;
        
        // 3. Deneme sınavı objesi kontrolü
        if (s.denemeSinavi || s.deneme_sinavi) return false;
        
        // 4. Açıklamada "[Deneme" içeren soruları filtrele
        if (s.aciklama && typeof s.aciklama === 'string' && s.aciklama.includes('[Deneme')) return false;
        
        // 5. Açıklamada "Deneme" kelimesi içeren soruları da kontrol et (daha geniş)
        if (s.aciklama && typeof s.aciklama === 'string' && /deneme/i.test(s.aciklama)) return false;
        
        // 6. Deneme sınavı soruları tablosunda kayıtlı olup olmadığını kontrol et
        if (s.isDenemeSoru === true || s.is_deneme_soru === true) return false;
        
        return true;
      });
      
      console.log(`AutoGetirSorular - Toplam ${data?.length || 0} soru, ${normalSorular.length} normal soru, ${(data?.length || 0) - normalSorular.length} deneme sınavı sorusu filtrelendi`);
      
      setSorular(normalSorular);
      setSecimler({});
      setCurrent(0);
      if (!normalSorular.length) {
        setMsg("Bu filtrede soru bulunamadı.");
        setStep("select");
      } else {
        setMsg("");
        setStep("ready");
      }
    } catch (e) {
      setMsg("Sorular alınamadı: " + errText(e));
    }
  }

  // --- api calls ---
  async function fetchDersler() {
    try {
      const { data } = await api.get("/api/ders");
      // "Sosyal Bilimler" dersini filtrele
      const filtrelenmis = (data || []).filter(d => 
        (d.ad || '').toLowerCase() !== 'sosyal bilimler'
      );
      setDersler(filtrelenmis);
    } catch (e) {
      setMsg("Dersler alınamadı: " + errText(e));
    }
  }

  async function fetchKonular(dersId) {
    try {
      const { data } = await api.get("/api/konu", { params: { dersId } });
      setKonular(data || []);
    } catch (e) {
      setMsg("Konular alınamadı: " + errText(e));
    }
  }

  async function getirSorular() {
    if (!seciliDersId) return setMsg("Önce ders seçin.");
    try {
      const params = { dersId: Number(seciliDersId), limit: 100 };
      if (seciliKonuId) params.konuId = Number(seciliKonuId);
      // Deneme sınavı sorularını hariç tutmak için parametre ekle
      params.excludeDenemeSinavi = true;
      
      const { data } = await api.get("/api/sorular", { params });
      
      // Debug: İlk sorunun yapısını kontrol et
      if (data && data.length > 0) {
        console.log("Backend'den gelen ilk soru örneği:", {
          id: data[0].id,
          denemeAdi: data[0].denemeAdi,
          deneme_adi: data[0].deneme_adi,
          denemeSinaviId: data[0].denemeSinaviId,
          deneme_sinavi_id: data[0].deneme_sinavi_id,
          denemeSinavi: data[0].denemeSinavi,
          deneme_sinavi: data[0].deneme_sinavi,
          aciklama: data[0].aciklama,
          tümAlanlar: Object.keys(data[0])
        });
      }
      
      // Deneme sınavı sorularını filtrele - tüm olası alanları kontrol et
      const normalSorular = (data || []).filter(s => {
        // 1. Deneme adı kontrolü
        const denemeAdi = s.denemeAdi || s.deneme_adi || s.denemeAd || s.deneme_ad;
        if (denemeAdi) {
          console.log("Deneme adı bulundu, filtrele:", s.id, denemeAdi);
          return false;
        }
        
        // 2. Deneme sınavı ID kontrolü - tüm olası alan adları
        if (s.denemeSinaviId || s.deneme_sinavi_id || s.denemeSinaviId || s.deneme_sinavi_Id) {
          console.log("Deneme sınavı ID bulundu, filtrele:", s.id, s.denemeSinaviId || s.deneme_sinavi_id);
          return false;
        }
        
        // 3. Deneme sınavı objesi kontrolü
        if (s.denemeSinavi || s.deneme_sinavi) {
          console.log("Deneme sınavı objesi bulundu, filtrele:", s.id);
          return false;
        }
        
        // 4. Açıklamada "[Deneme" içeren soruları filtrele
        if (s.aciklama && typeof s.aciklama === 'string' && s.aciklama.includes('[Deneme')) {
          console.log("Açıklamada [Deneme bulundu, filtrele:", s.id);
          return false;
        }
        
        // 5. Açıklamada "Deneme" kelimesi içeren soruları da kontrol et (daha geniş)
        if (s.aciklama && typeof s.aciklama === 'string' && /deneme/i.test(s.aciklama)) {
          console.log("Açıklamada 'deneme' kelimesi bulundu, filtrele:", s.id);
          return false;
        }
        
        // 6. Deneme sınavı soruları tablosunda kayıtlı olup olmadığını kontrol et
        // Backend'den gelen sorularda bu bilgi varsa kullan
        if (s.isDenemeSoru === true || s.is_deneme_soru === true) {
          console.log("isDenemeSoru flag'i bulundu, filtrele:", s.id);
          return false;
        }
        
        return true;
      });
      
      console.log(`Toplam ${data?.length || 0} soru, ${normalSorular.length} normal soru, ${(data?.length || 0) - normalSorular.length} deneme sınavı sorusu filtrelendi`);
      
      setSorular(normalSorular);
      setSecimler({});
      setCurrent(0);
      if (!normalSorular.length) {
        setMsg("Bu filtrede soru bulunamadı.");
        setStep("select");
      } else {
        setMsg("");
        setStep("ready"); // Teste Başla butonunu göster
      }
    } catch (e) {
      setMsg("Sorular alınamadı: " + errText(e));
    }
  }

  // --- test akışı ---
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

  const answeredCount = Object.keys(secimler).length;
  const emptyCount = sorular.filter(s => secimler[s.id] === undefined).length;
  const progressPercent = sorular.length > 0 ? (answeredCount / sorular.length) * 100 : 0;

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
      // res: { oturumId, correct, wrong, total, score }
      setMsg("");
      setStep("result");
      // sonucu state'e koy
      setResult(res);
      
      // Soru çözme aktivitesi kaydet
      await saveQuizActivity(res);
    } catch (e) {
      setMsg("Gönderim başarısız: " + errText(e));
      // süre görünmeye devam etmesin
      setStep("ready");
    }
  }
  
  // Soru çözme aktivitesi kaydet
  const saveQuizActivity = async (quizResult) => {
    try {
      // Ders bilgilerini al
      const ders = dersler.find(d => d.id === Number(seciliDersId));
      const dersAd = ders?.ad || "Bilinmeyen Ders";
      
      // Konu bilgilerini al (eğer seçiliyse)
      let konuAd = "";
      let konuId = null;
      if (seciliKonuId) {
        const konu = konular.find(k => k.id === Number(seciliKonuId));
        konuAd = konu?.ad || "";
        konuId = konu?.id || null;
      }
      
      // Aktivite başlığı oluştur
      const activityTitle = konuAd 
        ? `${dersAd} > ${konuAd}`
        : `${dersAd} > Soru Çözme`;
      
      const activityData = {
        activityType: "soru_cozme",
        activityTitle: activityTitle,
        activitySubtitle: `${quizResult.correct || 0} doğru, ${quizResult.wrong || 0} yanlış`,
        activityIcon: "abc",
        dersId: ders?.id || Number(seciliDersId),
        konuId: konuId,
        raporId: quizResult.oturumId,
        createdAt: new Date().toISOString(),
        metadata: {
          soruSayisi: quizResult.total || sorular.length,
          dogru: quizResult.correct || 0,
          yanlis: quizResult.wrong || 0,
          net: quizResult.score || 0
        }
      };
      
      try {
        // Backend'e kaydet
        await api.post("/api/activities", activityData);
        console.log("Soru çözme aktivitesi backend'e kaydedildi:", activityData);
      } catch (error) {
        console.error("Soru çözme aktivitesi backend'e kaydedilemedi:", error);
        // Backend yoksa localStorage'a kaydet (fallback - kullanıcıya özel)
        try {
          const userId = me?.id || "guest";
          const storageKey = `quizActivities_${userId}`;
          const savedActivities = JSON.parse(localStorage.getItem(storageKey) || "[]");
          savedActivities.unshift({
            id: `local_quiz_${Date.now()}_${quizResult.oturumId}`,
            ...activityData
          });
          // Son 50 aktiviteyi tut
          const limited = savedActivities.slice(0, 50);
          localStorage.setItem(storageKey, JSON.stringify(limited));
          console.log("Soru çözme aktivitesi localStorage'a kaydedildi:", activityData);
        } catch (localError) {
          console.error("Soru çözme aktivitesi localStorage'a kaydedilemedi:", localError);
        }
      }
    } catch (error) {
      console.error("Aktivite kaydetme hatası:", error);
      // Hata olsa bile devam et
    }
  };

  const [result, setResult] = useState(null);

  // --- render ---
  return (
    <div className="sorucoz-container">
      <div className="sorucoz-wrapper">
        {/* Header */}
        <div className="sorucoz-header">
          <div className="sorucoz-header-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {step !== "running" && (
                <button 
                  type="button" 
                  onClick={() => (onBack ? onBack() : window.history.back())}
                  className="nav-btn nav-btn-prev"
                  style={{ padding: '8px 16px' }}
                >
                  ← Geri
                </button>
              )}
              <h2 className="sorucoz-title">🎯 Soru Çöz</h2>
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

          {/* Seçim Barı */}
          {(step === "select" || step === "ready") && (
            <div className="select-bar">
              <select value={seciliDersId} onChange={(e) => setSeciliDersId(e.target.value)}>
                <option value="">📚 Ders Seçin</option>
                {dersler.map((d) => (
                  <option key={d.id} value={d.id}>{d.ad}</option>
                ))}
              </select>

              <select value={seciliKonuId} onChange={(e) => setSeciliKonuId(e.target.value)} disabled={!seciliDersId}>
                <option value="">📖 Konu Seçin (İsteğe bağlı)</option>
                {konular.map((k) => (
                  <option key={k.id} value={k.id}>{k.ad}</option>
                ))}
              </select>

              <button type="button" onClick={getirSorular} className="getir-btn">
                Soruları Getir
              </button>
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
                    <span>✅</span> {answeredCount} Cevaplanan
                  </span>
                  <span className="progress-stat">
                    <span>⭕</span> {emptyCount} Boş
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
        {step === "ready" && (
          <div className="ready-state">
            <div className="ready-icon">🎯</div>
            <h3>Hazırsın!</h3>
            <p>
              <b>{sorular.length}</b> soru seni bekliyor
            </p>
            <button type="button" onClick={startTest} className="start-test-btn">
              🚀 Teste Başla
            </button>
          </div>
        )}

        {/* Running State */}
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

        {/* Result State */}
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
