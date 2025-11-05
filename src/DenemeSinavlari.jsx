import { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
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
  const [seciliDenemeId, setSeciliDenemeId] = useState(null);
  const [sorular, setSorular] = useState([]);
  const [step, setStep] = useState("select"); // select -> ready -> running -> result
  const [current, setCurrent] = useState(0);
  const [secimler, setSecimler] = useState({});
  // elapsedMs ve timerRef artık TimerDisplay component'inde yönetiliyor
  const startedAtRef = useRef(null);
  const [msg, setMsg] = useState("");
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingDenemeler, setLoadingDenemeler] = useState(false);
  const [result, setResult] = useState(null);
  const fetchDenemeListesiRef = useRef(false);

  const errText = (e) =>
    e?.response?.data?.message || e?.response?.data?.error || e?.response?.data || e?.message || "Hata";

  // sureStr'i kaldırdık - artık TimerDisplay component'inde

  useEffect(() => {
    fetchDenemeListesi();
  }, []);

  // Timer'ı sadece step === "running" olduğunda başlat
  useEffect(() => {
    if (step === "running") {
      startedAtRef.current = new Date();
      // TimerDisplay component'i kendi timer'ını yönetiyor
      // Burada sadece başlangıç zamanını kaydediyoruz
    } else {
      // Step "running" değilse timer'ı durdur
      // TimerDisplay component'i unmount olunca otomatik temizlenir
    }
  }, [step]);

  // TimerDisplay component'i - ayrı component olarak timer'ı izole ediyoruz
  function TimerDisplay({ startedAt }) {
    const [elapsedMs, setElapsedMs] = useState(0);

    useEffect(() => {
      if (!startedAt) return;
      
      const timer = setInterval(() => {
        setElapsedMs(Date.now() - startedAt.getTime());
      }, 1000);
      
      return () => clearInterval(timer);
    }, [startedAt]);

    const s = Math.floor(elapsedMs / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    
    return <span>{mm}:{ss}</span>;
  }

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
    if (loadingDenemeler || fetchDenemeListesiRef.current) {
      console.log("Denemeler zaten yükleniyor veya yüklendi...");
      return;
    }
    try {
      fetchDenemeListesiRef.current = true;
      setLoadingDenemeler(true);
      console.log("fetchDenemeListesi başlatıldı");
      
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
        // Her deneme için sorularını çek (seçenekler dahil değil, sadece liste)
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
              if (sorular.length > 0) {
                const ilkSoru = sorular[0];
                console.log("İlk soru (backend'den):", JSON.stringify(ilkSoru, null, 2));
                console.log("İlk sorunun secenekleri (backend'den):", ilkSoru?.secenekler);
                console.log("Seçenekler array mi?", Array.isArray(ilkSoru?.secenekler));
                console.log("Seçenekler uzunluğu:", ilkSoru?.secenekler?.length);
                
                // Eğer seçenekler yoksa, quiz-sorular endpoint'ini de dene
                if (!ilkSoru?.secenekler || !Array.isArray(ilkSoru.secenekler) || ilkSoru.secenekler.length === 0) {
                  console.log("Seçenekler yok, quiz-sorular endpoint'i deneniyor...");
                  try {
                    const { data: quizData } = await api.get(`/api/deneme-sinavlari/${denemeId}/quiz-sorular`);
                    if (Array.isArray(quizData) && quizData.length > 0) {
                      console.log("Quiz-sorular'dan gelen:", quizData.length, "soru");
                      console.log("İlk soru (quiz-sorular):", JSON.stringify(quizData[0], null, 2));
                      sorular = quizData;
                    }
                  } catch (quizErr) {
                    console.warn("Quiz-sorular endpoint'i çalışmadı:", quizErr);
                  }
                }
              }
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
            
            // Seçenekleri burada yükleme, sadece soru listesini kaydet
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
          id: deneme.id || deneme.deneme_sinavi_id || null,
          adi: deneme.adi || deneme.deneme_adi,
          soruSayisi: deneme.sorular ? deneme.sorular.length : 0,
          sorular: deneme.sorular || []
        });
      });

      // Her kategorideki denemeleri sırala
      Object.keys(kategoriler).forEach(kategori => {
        kategoriler[kategori].sort((a, b) => a.adi.localeCompare(b.adi));
      });

      console.log("Deneme listesi güncelleniyor...");
      setDenemeListesi(kategoriler);
      setLoadingDenemeler(false);
      console.log("fetchDenemeListesi tamamlandı");
    } catch (e) {
      console.error("fetchDenemeListesi hatası:", e);
      setMsg("Deneme sınavları alınamadı: " + errText(e));
      setLoadingDenemeler(false);
      fetchDenemeListesiRef.current = false;
    }
  }

  function startDeneme(deneme) {
    try {
      console.log("startDeneme çağrıldı, deneme:", deneme);
      if (!deneme || !deneme.sorular || deneme.sorular.length === 0) {
        setMsg("Bu deneme sınavında soru bulunamadı!");
        return;
      }
      
      const denemeId = deneme.id || deneme.deneme_sinavi_id;
      console.log(`Deneme ${deneme.adi} (ID: ${denemeId}) için ${deneme.sorular.length} soru bulundu`);
      
      // Deneme ID'sini kaydet
      setSeciliDenemeId(denemeId);
      
      // Backend artık SoruDTO formatında seçenekleriyle birlikte gönderiyor
      // Eğer seçenekler yoksa veya eksikse, quiz-sorular endpoint'ini kullan
      const ilkSoru = deneme.sorular[0];
      const seceneklerVar = ilkSoru?.secenekler && Array.isArray(ilkSoru.secenekler) && ilkSoru.secenekler.length > 0;
      
      console.log("İlk soru:", ilkSoru);
      console.log("Seçenekler var mı?", seceneklerVar);
      console.log("Seçenekler:", ilkSoru?.secenekler);
      
      if (!seceneklerVar && denemeId) {
        console.log("Seçenekler yok, quiz-sorular endpoint'i kullanılıyor...");
        setMsg("Sorular yükleniyor...");
        api.get(`/api/deneme-sinavlari/${denemeId}/quiz-sorular`)
          .then(({ data }) => {
            console.log("Quiz-sorular'dan gelen veri:", data);
            if (Array.isArray(data) && data.length > 0) {
              console.log("İlk soru (quiz-sorular):", data[0]);
              console.log("İlk sorunun secenekleri:", data[0]?.secenekler);
              setSeciliDeneme(deneme);
              setSorular(data);
              setSecimler({});
              setCurrent(0);
              setMsg("");
              setStep("ready");
            } else {
              // Fallback
              setSeciliDeneme(deneme);
              setSorular(deneme.sorular || []);
              setSecimler({});
              setCurrent(0);
              setMsg("");
              setStep("ready");
            }
          })
          .catch((e) => {
            console.error("Quiz-sorular endpoint'i hata:", e);
            setSeciliDeneme(deneme);
            setSorular(deneme.sorular || []);
            setSecimler({});
            setCurrent(0);
            setMsg("");
            setStep("ready");
          });
        return;
      }
      
      // Seçenekler varsa direkt kullan
      console.log("Seçenekler mevcut, direkt kullanılıyor");
      setSeciliDeneme(deneme);
      setSorular(deneme.sorular || []);
      setSecimler({});
      setCurrent(0);
      setMsg("");
      setStep("ready");
    } catch (e) {
      console.error("startDeneme hatası:", e);
      setMsg("Deneme başlatılamadı: " + errText(e));
    }
  }

  const SoruCardModern = memo(function SoruCardModern({ soru, soruNo, totalSoru, seciliId, isFlagged, onChoose, onClear, onToggleFlag }) {
    const secenekHarfleri = ['A', 'B', 'C', 'D', 'E'];
    
    if (!soru) {
      return (
        <div className="soru-card-modern">
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            Soru yükleniyor...
          </div>
        </div>
      );
    }
    
    const soruId = soru.id;
    if (!soruId) {
      return (
        <div className="soru-card-modern">
          <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
            Soru verisi geçersiz! (ID yok)
          </div>
        </div>
      );
    }
    
    // seciliId'yi normalize et (null/undefined yerine undefined kullan)
    const normalizedSeciliId = seciliId !== null && seciliId !== undefined ? seciliId : undefined;
    
    try {
      return (
        <div className="soru-card-modern">
          <div className="soru-card-header">
            <div className="soru-number">
              <span>Soru {soruNo || 1}</span>
              <span className="soru-badge">{soruNo || 1} / {totalSoru || 1}</span>
            </div>
            <div className="soru-actions">
              {normalizedSeciliId && (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => onClear && onClear(soruId)}
                  title="Boş Bırak"
                >
                  ⭕ Boş Bırak
                </button>
              )}
              <button
                type="button"
                className={`flag-btn ${isFlagged ? 'flagged' : ''}`}
                onClick={() => onToggleFlag && onToggleFlag(soruId)}
                title={isFlagged ? "İşareti Kaldır" : "İşaretle"}
              >
                {isFlagged ? '🚩' : '⚐'}
              </button>
            </div>
          </div>

          {soru.konular && Array.isArray(soru.konular) && soru.konular.length > 0 && (
            <div className="soru-konular">
              {soru.konular.map((k) => (
                <span key={k?.id || Math.random()} className="konu-chip">
                  {k?.ad || ''}
                </span>
              ))}
            </div>
          )}

          <div className="soru-metin">
            {soru.metin || soru.soru_metni || soru.soruMetni || soru.text || soru.question || (soru.id ? `Soru ID: ${soru.id} (Metin bulunamadı)` : 'Soru verisi geçersiz')}
          </div>

          {soru.imageUrl && (
            <img 
              src={fileUrl(soru.imageUrl)} 
              alt="Soru görseli" 
              className="soru-image"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}

          <div className="secenekler-grid">
            {Array.isArray(soru.secenekler) && soru.secenekler.length > 0 ? (
              soru.secenekler.map((opt, index) => {
                if (!opt) return null;
                // Backend'den id null gelebilir, bu durumda index kullan
                const optId = opt.id || `opt_${soruId}_${index}`;
                const optMetin = opt.metin || opt.text || '';
                // seciliId kontrolü: backend'den id null geldiği için index ile eşleştirme yap
                // Eğer seciliId bir string ise (opt_${soruId}_${index} formatında), o zaman eşleşir
                // Eğer seciliId bir sayı ise, opt.id ile eşleşir
                const isSelected = normalizedSeciliId !== undefined && (
                  normalizedSeciliId === opt.id || 
                  normalizedSeciliId === optId ||
                  normalizedSeciliId === `opt_${soruId}_${index}`
                );
                
                return (
                  <div key={optId} className="secenek-item">
                    <input
                      type="radio"
                      id={`opt_${optId}_${soruId}`}
                      name={`q_${soruId}`}
                      value={optId}
                      checked={isSelected}
                      onChange={() => {
                        // Backend'den id null geldiği için index bazlı ID kullan
                        const selectedId = opt.id || `opt_${soruId}_${index}`;
                        console.log(`Seçenek seçildi: soruId=${soruId}, secenekId=${selectedId}, index=${index}`);
                        onChoose && onChoose(soruId, selectedId);
                      }}
                      className="secenek-input"
                    />
                    <label htmlFor={`opt_${optId}_${soruId}`} className="secenek-label">
                      <div className="secenek-radio"></div>
                      <span className="secenek-letter">{secenekHarfleri[index] || opt.siralama || String.fromCharCode(65 + index)}</span>
                      <span className="secenek-text">{optMetin}</span>
                    </label>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
                Bu soru için seçenek bulunamadı
              </div>
            )}
          </div>
        </div>
      );
    } catch (error) {
      console.error("SoruCardModern render hatası:", error);
      return (
        <div className="soru-card-modern">
          <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
            Soru yüklenirken bir hata oluştu: {error.message}
          </div>
        </div>
      );
    }
  }, (prevProps, nextProps) => {
    // Custom comparison: Sadece ilgili prop'lar değiştiğinde re-render
    // soru objesi referansı değişse bile, ID aynıysa re-render etme
    const prevSoruId = prevProps.soru?.id;
    const nextSoruId = nextProps.soru?.id;
    
    return (
      prevSoruId === nextSoruId &&
      prevProps.soruNo === nextProps.soruNo &&
      prevProps.totalSoru === nextProps.totalSoru &&
      prevProps.seciliId === nextProps.seciliId &&
      prevProps.isFlagged === nextProps.isFlagged
    );
  });

  function startTest() {
    if (loadingOptions) {
      console.log("Seçenekler yükleniyor, bekleniyor...");
      return;
    }
    
    if (sorular.length === 0) {
      setMsg("Soru bulunamadı!");
      return;
    }
    
    const ilkSoru = sorular[0];
    const seceneklerVar = ilkSoru?.secenekler && Array.isArray(ilkSoru.secenekler) && ilkSoru.secenekler.length > 0;
    
    console.log("startTest çağrıldı");
    console.log("Sorular sayısı:", sorular.length);
    console.log("İlk soru:", ilkSoru);
    console.log("Seçenekler var mı?", seceneklerVar);
    console.log("Seçenekler:", ilkSoru?.secenekler);
    
    // Eğer seçenekler yoksa ve deneme ID varsa, quiz-sorular endpoint'ini kullan
    if (!seceneklerVar && seciliDenemeId) {
      console.warn("Seçenekler yok, quiz-sorular endpoint'i kullanılıyor");
      loadQuestionOptions();
      return;
    }
    
    // Seçenekler varsa direkt başlat
    console.log("Seçenekler mevcut, test başlatılıyor");
    setStep("running");
    // Timer artık useEffect ile otomatik başlatılıyor
  }

  async function loadQuestionOptions() {
    if (loadingOptions) {
      console.log("Seçenekler zaten yükleniyor...");
      return;
    }
    
    // Eğer seciliDeneme varsa, backend'den direkt quiz-sorular endpoint'ini kullan
    if (seciliDenemeId) {
      try {
        setLoadingOptions(true);
        setMsg("Soruların seçenekleri yükleniyor...");
        console.log(`Deneme ${seciliDenemeId} için quiz-sorular endpoint'i çağrılıyor...`);
        const { data } = await api.get(`/api/deneme-sinavlari/${seciliDenemeId}/quiz-sorular`);
        console.log("Quiz-sorular endpoint'inden gelen veri:", data);
        if (Array.isArray(data) && data.length > 0) {
          console.log("İlk soru (quiz-sorular'den):", data[0]);
          console.log("İlk sorunun secenekleri (quiz-sorular'den):", data[0]?.secenekler);
          setSorular(data);
          setMsg("");
          setLoadingOptions(false);
          setTimeout(() => {
            setStep("running");
            // Timer artık useEffect ile otomatik başlatılıyor
          }, 100);
          return;
        }
      } catch (e) {
        console.error("quiz-sorular endpoint'i çalışmadı:", e);
      }
    }
    
    // Fallback: Te tek soru yükleme
    try {
      setLoadingOptions(true);
      setMsg("Soruların seçenekleri yükleniyor...");
      
      // Tüm soru ID'lerini topla
      const soruIds = sorular.map(s => s.id).filter(Boolean);
      console.log(`${soruIds.length} soru için seçenekler yüklenecek`);
      
      // Her soruyu /api/sorular/{id} endpoint'inden çek (seçenekler dahil)
      const sorularWithOptions = await Promise.all(
        soruIds.map(async (soruId) => {
          try {
            const { data: soruDetay } = await api.get(`/api/sorular/${soruId}`);
            console.log(`Soru ${soruId} detayı yüklendi, secenekler:`, soruDetay?.secenekler?.length || 0);
            if (soruDetay && soruDetay.id) {
              return soruDetay;
            }
            // Eğer tek soru çekilemezse, mevcut soruyu bul ve geri döndür
            return sorular.find(s => s.id === soruId) || null;
          } catch (e) {
            console.warn(`Soru ${soruId} detayı alınamadı:`, e.response?.status || e.message);
            // Hata durumunda mevcut soruyu döndür
            return sorular.find(s => s.id === soruId) || null;
          }
        })
      );
      
      // Null değerleri filtrele
      const validSorular = sorularWithOptions.filter(Boolean);
      console.log(`${validSorular.length} soru seçeneklerle yüklendi`);
      console.log("İlk soru (seçeneklerle):", validSorular[0]);
      console.log("İlk sorunun secenekleri:", validSorular[0]?.secenekler);
      
      if (validSorular.length === 0) {
        setMsg("Soruların seçenekleri yüklenemedi. Lütfen admin panelinden kontrol edin.");
        setLoadingOptions(false);
        return;
      }
      
      setSorular(validSorular);
      setMsg("");
      setLoadingOptions(false);
      // Kısa bir gecikme ile running state'e geç
      setTimeout(() => {
        setStep("running");
        // Timer artık useEffect ile otomatik başlatılıyor
      }, 100);
    } catch (e) {
      console.error("loadQuestionOptions genel hatası:", e);
      setMsg("Seçenekler yüklenemedi: " + errText(e));
      setLoadingOptions(false);
      // Hata durumunda da soruları göster, seçenekler olmasa bile
      setStep("running");
      // Timer artık useEffect ile otomatik başlatılıyor
    }
  }

  const choose = useCallback((soruId, secenekId) => {
    // secenekId null veya undefined ise, seçim yapılamaz
    if (secenekId === null || secenekId === undefined) {
      console.warn("Seçenek ID geçersiz:", secenekId);
      return;
    }
    console.log(`Soru ${soruId} için seçenek ${secenekId} seçildi`);
    setSecimler((prev) => ({ ...prev, [soruId]: secenekId }));
  }, []);

  const clearAnswer = useCallback((soruId) => {
    setSecimler((prev) => {
      const next = { ...prev };
      delete next[soruId];
      return next;
    });
  }, []);

  const toggleFlag = useCallback((soruId) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(soruId)) {
        newSet.delete(soruId);
      } else {
        newSet.add(soruId);
      }
      return newSet;
    });
  }, []);

  function goToQuestion(index) {
    setCurrent(index);
  }

  async function submitTest() {
    try {
      // Timer useEffect tarafından otomatik durdurulacak (step !== "running" olduğunda)
      const finishedAt = new Date();
      
      console.log("=== SUBMIT TEST DEBUG ===");
      console.log("Toplam soru sayısı:", sorular.length);
      console.log("İlk 3 soru ID'leri:", sorular.slice(0, 3).map(s => ({ id: s.id, idType: typeof s.id })));
      console.log("Secili deneme ID:", seciliDenemeId);
      console.log("Secimler:", secimler);
      console.log("Secimler keys:", Object.keys(secimler));
      console.log("Secimler values:", Object.values(secimler));
      
      // Seçenek ID'lerini temizle - sadece sayısal ID'leri gönder
      const items = sorular
        .filter((q) => {
          // Null/undefined ID'leri filtrele
          if (!q || q.id === null || q.id === undefined) {
            console.warn("Soru ID'si null/undefined, filtreleniyor:", q);
            return false;
          }
          return true;
        })
        .map((q) => {
          const secenekId = secimler[q.id];
          console.log(`Soru ${q.id} için secenekId:`, secenekId, "tip:", typeof secenekId);
          console.log(`Soru ${q.id} seçenekleri:`, q.secenekler?.map((s, idx) => ({ index: idx, id: s.id, metin: s.metin })));
          
          // Eğer secenekId string ise (opt_X_Y formatında), gerçek seçenek ID'sini bul
          let finalSecenekId = null;
          
          if (secenekId) {
            // Eğer sayısal bir ID ise direkt kullan
            if (typeof secenekId === 'number' || (typeof secenekId === 'string' && /^\d+$/.test(secenekId))) {
              finalSecenekId = typeof secenekId === 'string' ? parseInt(secenekId, 10) : secenekId;
              console.log(`  → Sayısal ID, direkt kullanılıyor: ${finalSecenekId}`);
            } else if (typeof secenekId === 'string' && secenekId.startsWith('opt_')) {
              // opt_X_Y formatında ise, sorunun seçeneklerinden gerçek ID'yi bul
              const match = secenekId.match(/opt_(\d+)_(\d+)/);
              if (match) {
                const soruId = parseInt(match[1], 10);
                const index = parseInt(match[2], 10);
                const soru = sorular.find(s => s.id === soruId);
                console.log(`  → opt_X_Y formatında, soru bulundu:`, soru ? "evet" : "hayır", "index:", index);
                if (soru && soru.secenekler && soru.secenekler[index]) {
                  const secenek = soru.secenekler[index];
                  console.log(`  → Seçenek bulundu:`, secenek, "secenek.id:", secenek.id);
                  // Gerçek seçenek ID'sini kullan (eğer varsa)
                  if (secenek.id && (typeof secenek.id === 'number' || /^\d+$/.test(String(secenek.id)))) {
                    finalSecenekId = typeof secenek.id === 'string' ? parseInt(secenek.id, 10) : secenek.id;
                    console.log(`  → Gerçek seçenek ID'si kullanılıyor: ${finalSecenekId}`);
                  } else {
                    // Gerçek ID yoksa, backend'e seçenek sırasını gönder (index + 1, çünkü backend 1-based olabilir)
                    // VEYA backend'e sıralama (siralama) değerini gönder
                    console.warn(`  → Seçenek ID'si null/undefined. Seçenek sırası gönderiliyor: ${index + 1}`);
                    // Backend'in sıralama değerini kabul edip etmediğini bilmiyoruz, deneme amaçlı index + 1 gönderiyoruz
                    // Eğer backend siralama alanını bekliyorsa onu kullanabiliriz
                    if (secenek.siralama !== null && secenek.siralama !== undefined) {
                      finalSecenekId = secenek.siralama;
                      console.log(`  → Seçenek sıralaması kullanılıyor: ${finalSecenekId}`);
                    } else {
                      // Sıralama da yoksa index + 1 gönder (A=1, B=2, C=3, D=4, E=5)
                      finalSecenekId = index + 1;
                      console.log(`  → Seçenek index'i kullanılıyor (index + 1): ${finalSecenekId}`);
                    }
                  }
                } else {
                  console.warn(`  → Soru veya seçenek bulunamadı, null gönderiliyor`);
                }
              }
            } else {
              console.warn(`  → Beklenmeyen secenekId formatı:`, secenekId);
            }
          } else {
            console.log(`  → SecenekId null/undefined, boş cevap gönderiliyor`);
          }
          
          // Soru ID'sini sayıya çevir ve doğrula
          let soruId;
          if (typeof q.id === 'string') {
            soruId = parseInt(q.id, 10);
            if (isNaN(soruId)) {
              console.error("Soru ID'si geçersiz:", q.id);
              return null;
            }
          } else if (typeof q.id === 'number') {
            soruId = q.id;
          } else {
            console.error("Soru ID'si beklenmeyen tip:", typeof q.id, q.id);
            return null;
          }
          
          return {
            soruId: soruId,
            secenekId: finalSecenekId
          };
        })
        .filter(item => item !== null); // Null item'ları filtrele
      
      console.log("Oluşturulan items:", items);
      console.log("Items sayısı:", items.length);
      console.log("Cevap verilen soru sayısı:", items.filter(i => i.secenekId !== null).length);
      console.log("Boş soru sayısı:", items.filter(i => i.secenekId === null).length);
      console.log("İlk 5 item örneği:", items.slice(0, 5));
      console.log("Cevap verilen soruların örnekleri:", items.filter(i => i.secenekId !== null).slice(0, 5));
      
      if (items.length === 0) {
        throw new Error("Gönderilecek soru bulunamadı!");
      }
      
      const payload = {
        items,
        startedAt: startedAtRef.current?.toISOString() ?? new Date().toISOString(),
        finishedAt: finishedAt.toISOString(),
      };
      
      // Deneme sınavı için denemeId ekle (eğer varsa)
      if (seciliDenemeId) {
        // Deneme ID'sini de sayıya çevir
        const denemeIdNum = typeof seciliDenemeId === 'string' ? parseInt(seciliDenemeId, 10) : seciliDenemeId;
        if (!isNaN(denemeIdNum)) {
          payload.denemeSinaviId = denemeIdNum;
        }
      }
      
      console.log("Final payload:", JSON.stringify(payload, null, 2));
      
      // Önce deneme sınavı için özel endpoint'leri dene
      let res;
      const denemeIdNum = seciliDenemeId ? (typeof seciliDenemeId === 'string' ? parseInt(seciliDenemeId, 10) : seciliDenemeId) : null;
      
      if (denemeIdNum && !isNaN(denemeIdNum)) {
        // Deneme sınavı için birkaç alternatif endpoint dene
        const endpoints = [
          { url: `/api/deneme-sinavi/${denemeIdNum}/cevaplar`, method: 'POST' },
          { url: `/api/deneme-sinavi/${denemeIdNum}/cevap`, method: 'POST' },
          { url: `/api/deneme-sinavlari/${denemeIdNum}/cevaplar`, method: 'POST' },
          { url: `/api/deneme-sinavlari/${denemeIdNum}/cevap`, method: 'POST' },
          { url: `/api/deneme-sinavi/${denemeIdNum}/submit`, method: 'POST' },
          { url: `/api/deneme-sinavlari/${denemeIdNum}/submit`, method: 'POST' },
          { url: `/api/deneme-sinavi/submit`, method: 'POST', addDenemeId: true },
          { url: `/api/cevap/bulk`, method: 'POST', addDenemeId: true },
        ];
        
        let lastError = null;
        for (const endpoint of endpoints) {
          try {
            // Sadece çalışan endpoint'i logla, diğerlerini sessizce geç
            if (endpoint.url === `/api/cevap/bulk`) {
              console.log(`Deneme sınavı submit endpoint'i deneniyor: ${endpoint.method} ${endpoint.url}`);
            }
            
            let requestPayload = { ...payload };
            // Eğer denemeId body'ye eklenmesi gerekiyorsa
            if (endpoint.addDenemeId) {
              requestPayload.denemeSinaviId = denemeIdNum;
            }
            
            const { data } = await api.post(endpoint.url, requestPayload);
            res = data;
            console.log(`✅ ${endpoint.url} başarılı:`, res);
            break; // Başarılı olursa döngüden çık
          } catch (e) {
            // Sadece çalışan endpoint'e kadar olanları logla, sonrakileri sessizce geç
            if (endpoint.url === `/api/cevap/bulk`) {
              const errorMsg = e.response?.data?.error || e.response?.data?.message || e.message;
              console.warn(`❌ ${endpoint.url} başarısız:`, errorMsg);
            }
            lastError = e;
            // Sonraki endpoint'i dene
            continue;
          }
        }
        
        // Eğer hiçbir deneme endpoint'i çalışmadıysa, normal quiz endpoint'ini dene ama denemeSinaviId'yi kaldır
        if (!res) {
          console.warn("Tüm deneme sınavı endpoint'leri başarısız oldu. Backend'de deneme sınavı için özel bir endpoint olması gerekiyor.");
          console.warn("Lütfen backend geliştiricisine şu endpoint'lerden birini eklemesini söyleyin:");
          console.warn("- POST /api/deneme-sinavi/{id}/cevaplar");
          console.warn("- POST /api/deneme-sinavi/{id}/submit");
          console.warn("Veya mevcut /api/quiz/submit endpoint'ini deneme sınavı sorularını da destekleyecek şekilde güncelleyin.");
          
          const normalPayload = { ...payload };
          delete normalPayload.denemeSinaviId; // denemeSinaviId'yi kaldır
          
          try {
            console.log("Son çare: Normal quiz endpoint'i deneniyor (denemeSinaviId olmadan)");
            res = await submitQuiz(normalPayload);
            console.log("Normal quiz endpoint başarılı:", res);
          } catch (e2) {
            console.error("Normal quiz endpoint de başarısız:", e2.response?.data || e2.message);
            throw new Error(`Deneme sınavı sonuçları gönderilemedi. Backend'de deneme sınavı için özel bir endpoint gerekiyor. Hata: ${errText(lastError || e2)}`);
          }
        }
      } else {
        // Deneme ID yoksa normal quiz endpoint'i kullan
        console.log("Normal quiz endpoint'i kullanılıyor: /api/quiz/submit");
        try {
          res = await submitQuiz(payload);
          console.log("Normal quiz submit başarılı:", res);
        } catch (e) {
          console.error("Normal quiz endpoint başarısız:", e.response?.data || e.message);
          throw e;
        }
      }
      
      setMsg("");
      setStep("result");
      setResult(res);
    } catch (e) {
      console.error("Submit error:", e);
      console.error("Error response:", e.response?.data);
      setMsg("Gönderim başarısız: " + errText(e));
      setStep("ready");
    }
  }

  // Mevcut soruyu memoize et - dependency listesini sadeleştir
  const currentSoru = useMemo(() => {
    return sorular[current] || null;
  }, [current, sorular]);

  // Mevcut soru ID'sini memoize et
  const currentSoruId = useMemo(() => {
    return currentSoru?.id || null;
  }, [currentSoru]); // currentSoru zaten memoize edilmiş, onu kullan

  // Mevcut sorunun seçili ID'sini memoize et - sadece soru ID veya secimler değiştiğinde
  const currentSeciliId = useMemo(() => {
    if (!currentSoruId) return undefined;
    return secimler[currentSoruId] ?? undefined;
  }, [currentSoruId, secimler[currentSoruId]]);

  // Mevcut sorunun flag durumunu memoize et
  const currentIsFlagged = useMemo(() => {
    if (!currentSoruId) return false;
    return flaggedQuestions.has(currentSoruId);
  }, [currentSoruId, flaggedQuestions]); // Set referansı değiştiğinde de güncelle

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
                <TimerDisplay startedAt={startedAtRef.current} />
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

        {step === "running" && (
          <>
            {sorular.length === 0 ? (
              <div className="soru-card-modern">
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Soru bulunamadı!
                </div>
              </div>
            ) : !sorular[current] ? (
              <div className="soru-card-modern">
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Soru yükleniyor...
                </div>
              </div>
            ) : (
              <div className="deneme-test-container">
                {/* Sol Taraf - Soru Kartı ve Navigasyon */}
                <div className="deneme-test-main">
                  {/* Soru Kartı */}
                  <SoruCardModern
                    soru={currentSoru}
                    soruNo={current + 1}
                    totalSoru={sorular.length}
                    seciliId={currentSeciliId}
                    isFlagged={currentIsFlagged}
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
                </div>

                {/* Sağ Taraf - Optik Form */}
                <div className="deneme-optik-form-container">
                  <div className="optik-form-header">
                    <h3>Optik Form</h3>
                    <div className="optik-form-stats">
                      <span className="optik-stat">
                        <span className="optik-stat-dot answered-dot"></span>
                        Cevaplanan: {Object.keys(secimler || {}).length}
                      </span>
                      <span className="optik-stat">
                        <span className="optik-stat-dot empty-dot"></span>
                        Boş: {(sorular || []).filter(s => s && !secimler[s.id]).length}
                      </span>
                      <span className="optik-stat">
                        <span className="optik-stat-dot flagged-dot"></span>
                        İşaretli: {flaggedQuestions?.size || 0}
                      </span>
                    </div>
                  </div>
                  
                  <div className="optik-form-grid">
                    {(sorular || []).map((soru, index) => {
                      if (!soru) return null;
                      const soruId = soru.id;
                      const isAnswered = secimler[soruId] !== undefined;
                      const isEmpty = !isAnswered;
                      const isCurrent = index === current;
                      const isFlagged = flaggedQuestions?.has(soruId);
                      
                      return (
                        <button
                          key={soruId || index}
                          className={`optik-form-item ${
                            isCurrent ? 'optik-current' : ''
                          } ${isAnswered ? 'optik-answered' : ''} ${
                            isEmpty ? 'optik-empty' : ''
                          } ${isFlagged ? 'optik-flagged' : ''}`}
                          onClick={() => goToQuestion(index)}
                          title={`Soru ${index + 1}${isEmpty ? ' (Boş)' : ''}${isFlagged ? ' (İşaretli)' : ''}`}
                        >
                          <span className="optik-number">{index + 1}</span>
                          {isFlagged && <span className="optik-flag-icon">🚩</span>}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="optik-form-legend">
                    <div className="legend-item">
                      <div className="legend-box optik-answered"></div>
                      <span>Cevaplanan</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-box optik-empty"></div>
                      <span>Boş</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-box optik-current"></div>
                      <span>Mevcut Soru</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-box optik-flagged"></div>
                      <span>İşaretli</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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

