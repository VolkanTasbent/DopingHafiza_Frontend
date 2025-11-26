// src/Grafiklerim.jsx
import React, { useEffect, useState, useMemo } from "react";
import api from "./services/api";
import { Line, Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

import html2canvas from "html2canvas";
import "./Raporlarim.css";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend
);

export default function Grafiklerim({ onBack }) {
  const [raporlar, setRaporlar] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("all");
  
  // Tüm ders seçim state'leri
  const [selectedDers, setSelectedDers] = useState("all");
  const [selectedKonuDers, setSelectedKonuDers] = useState("all");
  const [selectedYanlisDers, setSelectedYanlisDers] = useState("all");
  const [selectedBosDers, setSelectedBosDers] = useState("all");
  const [selectedPieDers, setSelectedPieDers] = useState("all"); // Yeni: Pie chart için ders seçimi

  // Tüm hesaplamalar
  const grafikVerileri = useMemo(() => {
    console.log("🔄 Grafik verileri hesaplanıyor...");
    
    if (!filtered || filtered.length === 0) {
      return {
        lineLabels: [],
        lineData: [],
        totalDogru: 0,
        totalYanlis: 0,
        totalBos: 0,
        konuData: [],
        dersData: [],
        dersler: [],
        filteredDersData: [],
        wrongKonular: [],
        bosKonular: [],
        zorlukData: [],
        timeLabels: [],
        timeValues: [],
        denemeLabels: [],
        denemeBasari: [],
        hasItems: false,
        // Pie chart için ders bazlı veriler
        pieDogru: 0,
        pieYanlis: 0,
        pieBos: 0
      };
    }

    // Tarihe göre sıralama
    const sortedRaporlar = [...filtered].sort((a, b) => {
      const ta = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const tb = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return ta - tb;
    });

    const last10 = sortedRaporlar.slice(-10);

    // 1. Son 10 Oturum Başarı
    const lineLabels = last10.map((x, index) => {
      if (x.finishedAt) {
        return new Date(x.finishedAt).toLocaleDateString("tr-TR");
      }
      return `Oturum ${index + 1}`;
    });

    const lineData = last10.map((x) => {
      const dogru = x.correctCount || 0;
      const yanlis = x.wrongCount || 0;
      const bos = x.emptyCount || 0;
      const total = dogru + yanlis + bos;
      return total > 0 ? Math.round((dogru / total) * 100) : 0;
    });

    // 2. Toplam Doğru/Yanlış/Boş
    const totalDogru = sortedRaporlar.reduce((t, x) => t + (x.correctCount || 0), 0);
    const totalYanlis = sortedRaporlar.reduce((t, x) => t + (x.wrongCount || 0), 0);
    const totalBos = sortedRaporlar.reduce((t, x) => t + (x.emptyCount || 0), 0);

    // 3. Net Gelişimi
    const netValues = last10.map((x) => {
      const dogru = x.correctCount || 0;
      const yanlis = x.wrongCount || 0;
      return parseFloat((dogru - (yanlis / 4)).toFixed(2));
    });

    // 4. Konu Bazlı Başarı - DERS BAZLI FİLTRELEME İÇİN GÜNCELLENDİ
    const konuMap = new Map();
    const hasItems = filtered.some(rapor => rapor.items && rapor.items.length > 0);

    // 5. DERS BAZLI PERFORMANS
    const dersMap = new Map();

    if (hasItems) {
      sortedRaporlar.forEach((r) => {
        if (r.items && Array.isArray(r.items)) {
          r.items.forEach((q) => {
            // BACKEND'DEN GELEN DERS BİLGİSİNİ AL
            let dersAdi = "Genel";
            
            if (q.soru && q.soru.dersAd) {
              dersAdi = q.soru.dersAd;
            }
            
            // ✅ BACKEND'DE dogru FIELD'INI KULLAN
            const dogruMu = q.dogru !== undefined ? q.dogru : false;
            const bosMu = q.secenekId === null || q.secenekId === undefined;
            
            if (!dersMap.has(dersAdi)) {
              dersMap.set(dersAdi, { dogru: 0, yanlis: 0, bos: 0 });
            }
            const dersData = dersMap.get(dersAdi);
            
            if (bosMu) {
              dersData.bos++;
            } else if (dogruMu) {
              dersData.dogru++;
            } else {
              dersData.yanlis++;
            }

            // Konu bazlı veri toplama - DERS BAZLI
            const konular = q.soru?.konular || [];
            
            if (konular && konular.length > 0) {
              konular.forEach((k) => {
                if (k && k.ad) {
                  const konuAdi = k.ad.trim();
                  const konuKey = `${konuAdi}||${dersAdi}`; // Konu + Ders kombinasyonu
                  
                  if (!konuMap.has(konuKey)) {
                    konuMap.set(konuKey, { 
                      konu: konuAdi, 
                      ders: dersAdi,
                      dogru: 0, 
                      yanlis: 0, 
                      bos: 0 
                    });
                  }
                  const konuData = konuMap.get(konuKey);
                  
                  if (bosMu) {
                    konuData.bos++;
                  } else if (dogruMu) {
                    konuData.dogru++;
                  } else {
                    konuData.yanlis++;
                  }
                }
              });
            } else {
              // Konu bilgisi yoksa
              const konuAdi = "Konu Belirtilmemiş";
              const konuKey = `${konuAdi}||${dersAdi}`;
              
              if (!konuMap.has(konuKey)) {
                konuMap.set(konuKey, { 
                  konu: konuAdi, 
                  ders: dersAdi,
                  dogru: 0, 
                  yanlis: 0, 
                  bos: 0 
                });
              }
              const konuData = konuMap.get(konuKey);
              
              if (bosMu) {
                konuData.bos++;
              } else if (dogruMu) {
                konuData.dogru++;
              } else {
                konuData.yanlis++;
              }
            }
          });
        }
      });
    }

    // Tüm dersleri listele
    const dersler = Array.from(dersMap.keys()).sort();

    // Pie chart için ders bazlı veriler
    let pieDogru = totalDogru;
    let pieYanlis = totalYanlis;
    let pieBos = totalBos;

    if (selectedPieDers !== "all" && hasItems) {
      const selectedDersData = dersMap.get(selectedPieDers);
      if (selectedDersData) {
        pieDogru = selectedDersData.dogru;
        pieYanlis = selectedDersData.yanlis;
        pieBos = selectedDersData.bos;
      } else {
        pieDogru = 0;
        pieYanlis = 0;
        pieBos = 0;
      }
    }

    // Seçilen derse göre filtrelenmiş data
    let filteredDersData = [];
    if (selectedDers === "all") {
      filteredDersData = Array.from(dersMap.entries())
        .map(([ders, data]) => ({
          ders,
          ...data,
          total: data.dogru + data.yanlis + data.bos,
          basariOrani: data.dogru + data.yanlis > 0 ? 
            Math.round((data.dogru / (data.dogru + data.yanlis)) * 100) : 0
        }))
        .filter(item => item.total > 0)
        .sort((a, b) => b.total - a.total);
    } else {
      const selectedData = dersMap.get(selectedDers);
      if (selectedData) {
        filteredDersData = [{
          ders: selectedDers,
          ...selectedData,
          total: selectedData.dogru + selectedData.yanlis + selectedData.bos,
          basariOrani: selectedData.dogru + selectedData.yanlis > 0 ? 
            Math.round((selectedData.dogru / (selectedData.dogru + selectedData.yanlis)) * 100) : 0
        }];
      }
    }

    // Tüm konu verileri
    const allKonuData = Array.from(konuMap.values())
      .map(data => ({
        ...data,
        total: data.dogru + data.yanlis + data.bos,
        basariOrani: data.dogru + data.yanlis > 0 ? 
          Math.round((data.dogru / (data.dogru + data.yanlis)) * 100) : 0
      }))
      .filter(item => item.total > 0);

    // Ders seçimine göre filtrelenmiş konu verileri
    const getFilteredKonuData = (selectedDersFilter) => {
      let filtered = allKonuData;
      
      if (selectedDersFilter !== "all") {
        filtered = allKonuData.filter(item => item.ders === selectedDersFilter);
      }
      
      return filtered.sort((a, b) => b.total - a.total);
    };

    // 6. En Çok Soru Çözülen Konular (İlk 15)
    const konuData = getFilteredKonuData(selectedKonuDers).slice(0, 15);

    // 7. En Çok Yanlış Yapılan Konular
    const wrongKonular = getFilteredKonuData(selectedYanlisDers)
      .filter(item => item.yanlis > 0)
      .sort((a, b) => b.yanlis - a.yanlis)
      .slice(0, 10);

    // 8. En Çok Boş Bırakılan Konular
    const bosKonular = getFilteredKonuData(selectedBosDers)
      .filter(item => item.bos > 0)
      .sort((a, b) => b.bos - a.bos)
      .slice(0, 10);

    // 9. Zorluk Seviyesi
    const zorlukMap = { 
      kolay: { dogru: 0, yanlis: 0, bos: 0 }, 
      orta: { dogru: 0, yanlis: 0, bos: 0 }, 
      zor: { dogru: 0, yanlis: 0, bos: 0 } 
    };
    
    if (hasItems) {
      sortedRaporlar.forEach((r) => {
        if (r.items && Array.isArray(r.items)) {
          r.items.forEach((q) => {
            const dogruMu = q.dogru !== undefined ? q.dogru : false;
            const bosMu = q.secenekId === null || q.secenekId === undefined;
            
            const zorluk = (q.soru?.zorluk || "orta").toString().toLowerCase();
            let zorlukKey = "orta";
            
            if (zorluk.includes("kolay") || zorluk === "1") {
              zorlukKey = "kolay";
            } else if (zorluk.includes("zor") || zorluk === "3") {
              zorlukKey = "zor";
            }
            
            if (bosMu) {
              zorlukMap[zorlukKey].bos++;
            } else if (dogruMu) {
              zorlukMap[zorlukKey].dogru++;
            } else {
              zorlukMap[zorlukKey].yanlis++;
            }
          });
        }
      });
    }

    const zorlukData = [
      { zorluk: "Kolay", ...zorlukMap.kolay },
      { zorluk: "Orta", ...zorlukMap.orta },
      { zorluk: "Zor", ...zorlukMap.zor }
    ];

    // 10. Süre Analizi
    const timeLabels = sortedRaporlar.map((x, i) => {
      const dateStr = x.finishedAt ? new Date(x.finishedAt).toLocaleDateString("tr-TR") : "";
      const baseName = x.denemeAdi || x.title || x.name || `Oturum ${i + 1}`;
      return dateStr ? `${baseName} (${dateStr})` : baseName;
    });

    const timeValues = sortedRaporlar.map((x) => {
      if (x.durationMs && x.durationMs > 0) {
        return Math.round(x.durationMs / 1000);
      }
      
      if (x.items && Array.isArray(x.items) && hasItems) {
        const totalMs = x.items.reduce((t, i) => t + (i.elapsedMs || 0), 0);
        if (totalMs > 0) {
          return Math.round(totalMs / 1000);
        }
      }
      
      return 0;
    });

    // 11. Oturum Bazlı Başarı
    const denemeLabels = sortedRaporlar.map((r, i) => {
      const dateStr = r.finishedAt
        ? new Date(r.finishedAt).toLocaleDateString("tr-TR")
        : "";
      const baseName = r.denemeAdi || r.title || r.name || `Oturum ${i + 1}`;
      return dateStr ? `${baseName} (${dateStr})` : baseName;
    });

    const denemeBasari = sortedRaporlar.map((r) => {
      const dogru = r.correctCount || 0;
      const yanlis = r.wrongCount || 0;
      const bos = r.emptyCount || 0;
      const total = dogru + yanlis + bos;
      return total > 0 ? Math.round((dogru / total) * 100) : 0;
    });

    return {
      lineLabels,
      lineData,
      totalDogru,
      totalYanlis,
      totalBos,
      netLabels: lineLabels,
      netValues,
      konuData,
      dersData: Array.from(dersMap.entries()).map(([ders, data]) => ({
        ders,
        ...data,
        total: data.dogru + data.yanlis + data.bos,
        basariOrani: data.dogru + data.yanlis > 0 ? 
          Math.round((data.dogru / (data.dogru + data.yanlis)) * 100) : 0
      })),
      dersler,
      filteredDersData,
      wrongKonular,
      bosKonular,
      zorlukData,
      timeLabels,
      timeValues,
      denemeLabels,
      denemeBasari,
      hasItems,
      // Pie chart için ders bazlı veriler
      pieDogru,
      pieYanlis,
      pieBos
    };
  }, [filtered, selectedDers, selectedKonuDers, selectedYanlisDers, selectedBosDers, selectedPieDers]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [raporlar, dateFilter]);

  const loadData = async () => {
    try {
      console.log("🔄 Grafikler için veri yükleniyor...");
      const { data } = await api.get("/api/raporlar/grafikler", { 
        params: { limit: 200 } 
      });
      
      console.log("📊 Grafik endpoint'inden gelen veri yapısı:", {
        toplamRapor: data.length,
        ilkRapor: data[0] ? {
          oturumId: data[0].oturumId,
          finishedAt: data[0].finishedAt,
          correctCount: data[0].correctCount,
          wrongCount: data[0].wrongCount,
          emptyCount: data[0].emptyCount,
          itemsVarMi: !!data[0].items,
          itemsUzunluk: data[0].items ? data[0].items.length : 0,
          ilkItemVarsa: data[0].items && data[0].items[0] ? {
            soruId: data[0].items[0].soru?.id,
            dersAd: data[0].items[0].soru?.dersAd,
            dogru: data[0].items[0].dogru,
            konular: data[0].items[0].soru?.konular,
          } : 'item yok'
        } : 'veri yok'
      });
      
      // Items kontrolü yap
      const itemsOlanRaporlar = data.filter(rapor => rapor.items && rapor.items.length > 0);
      console.log("📦 Items içeren raporlar:", itemsOlanRaporlar.length);

      const processedData = data.map(rapor => {
        let finishedAtDate = null;
        if (rapor.finishedAt) {
          finishedAtDate = new Date(rapor.finishedAt);
        }
        
        return {
          oturumId: rapor.oturumId,
          finishedAt: finishedAtDate,
          correctCount: rapor.correctCount || 0,
          wrongCount: rapor.wrongCount || 0,
          emptyCount: rapor.emptyCount || 0,
          durationMs: rapor.durationMs || 0,
          net: rapor.net || 0,
          items: rapor.items || [],
          totalCount: (rapor.correctCount || 0) + (rapor.wrongCount || 0) + (rapor.emptyCount || 0)
        };
      });
      
      setRaporlar(processedData);
    } catch (e) {
      console.error("❌ Grafik endpoint başarısız, eski endpoint deneniyor:", e);
      
      try {
        console.log("🔄 Eski endpoint deneniyor...");
        const { data } = await api.get("/api/raporlar", { params: { limit: 200 } });
        
        const processedData = data.map(rapor => {
          let finishedAtDate = null;
          if (rapor.finishedAt) {
            finishedAtDate = new Date(rapor.finishedAt);
          }
          
          return {
            oturumId: rapor.oturumId,
            finishedAt: finishedAtDate,
            correctCount: rapor.correctCount || 0,
            wrongCount: rapor.wrongCount || 0,
            emptyCount: rapor.emptyCount || 0,
            durationMs: rapor.durationMs || 0,
            net: rapor.net || 0,
            items: [],
            totalCount: (rapor.correctCount || 0) + (rapor.wrongCount || 0) + (rapor.emptyCount || 0)
          };
        });
        
        setRaporlar(processedData);
      } catch (fallbackError) {
        console.error("❌ Tüm endpoint'ler başarısız:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let arr = [...raporlar];

    if (dateFilter !== "all") {
      const now = Date.now();
      const days = dateFilter === "7" ? 7 : 30;
      const threshold = days * 24 * 60 * 60 * 1000;

      arr = arr.filter((r) => {
        if (!r.finishedAt) return false;
        const reportTime = new Date(r.finishedAt).getTime();
        return now - reportTime <= threshold;
      });
    }
    
    setFiltered(arr);
  };

  const exportPng = async (id) => {
    const element = document.getElementById(id);
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.href = imgData;
    link.download = `${id}.png`;
    link.click();
  };

  // Destructure grafik verileri
  const {
    lineLabels,
    lineData,
    totalDogru,
    totalYanlis,
    totalBos,
    netLabels,
    netValues,
    konuData,
    dersData,
    dersler,
    filteredDersData,
    wrongKonular,
    bosKonular,
    zorlukData,
    timeLabels,
    timeValues,
    denemeLabels,
    denemeBasari,
    hasItems,
    pieDogru,
    pieYanlis,
    pieBos
  } = grafikVerileri;

  if (loading) {
    return (
      <div className="raporlar-loading">
        <div className="loading-spinner"></div>
        <p>Grafikler yükleniyor...</p>
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <div className="raporlar-container">
        <div className="raporlar-header">
          <div className="raporlar-title-section">
            <h1 className="raporlar-title">Grafiklerim</h1>
            <p className="raporlar-subtitle">
              Grafik oluşturmak için test veya deneme çözmelisin.
            </p>
          </div>
          {onBack && (
            <button className="back-button" onClick={onBack}>
              ← Geri
            </button>
          )}
        </div>

        <div className="empty-state-raporlar">
          <h3>Seçilen filtrelere uygun rapor bulunamadı</h3>
          <p>Filtreleri temizleyip tekrar deneyin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="raporlar-container">
      {/* HEADER */}
      <div className="raporlar-header">
        <div className="raporlar-title-section">
          <h1 className="raporlar-title">Grafiklerim</h1>
          <p className="raporlar-subtitle">
            Test ve deneme performansını grafiklerle incele
          </p>
        </div>

        {onBack && (
          <button className="back-button" onClick={onBack}>
            ← Geri
          </button>
        )}
      </div>

      {/* ÖZET BİLGİ */}
      <div className="ozet-bilgi" style={{ 
        background: '#f8fafc', 
        padding: '15px', 
        margin: '10px 0', 
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{totalDogru}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Doğru</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{totalYanlis}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Yanlış</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6b7280' }}>{totalBos}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Boş</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6366f1' }}>{filtered.length}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Oturum</div>
          </div>
        </div>
        {!hasItems && (
          <div style={{ textAlign: 'center', marginTop: '10px', color: '#f59e0b', fontSize: '14px' }}>
            ⚠️ Detaylı analizler için items verisi yok
          </div>
        )}
      </div>

      {/* FİLTRE BAR - SADECE TARİH FİLTRESİ */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Tarih</label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">Tümü</option>
            <option value="7">Son 7 Gün</option>
            <option value="30">Son 30 Gün</option>
          </select>
        </div>
      </div>

      {/* GRAFİKLER */}
      <div className="grafik-panel">
        {/* 1 - Son 10 Oturum Başarı */}
        <div className="grafik-box" id="son10ChartBox">
          <div className="grafik-head">
            <h3>Son 10 Oturum Başarı</h3>
            <button onClick={() => exportPng("son10ChartBox")}>İndir</button>
          </div>
          {lineData.length > 0 ? (
            <Line
              data={{
                labels: lineLabels,
                datasets: [
                  {
                    label: "Başarı (%)",
                    data: lineData,
                    borderColor: "#667eea",
                    backgroundColor: "rgba(102,126,234,0.3)",
                    tension: 0.4,
                  },
                ],
              }}
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                  },
                },
              }}
            />
          ) : (
            <p className="grafik-note">Yeterli veri bulunamadı</p>
          )}
        </div>

        {/* 2 - Doğru/Yanlış/Boş Dağılımı - DERS SEÇİMLİ */}
        <div className="grafik-box" id="dybChartBox">
          <div className="grafik-head">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <h3>Doğru - Yanlış - Boş Dağılımı</h3>
              {hasItems && dersler.length > 0 && (
                <div className="filter-group" style={{ margin: 0 }}>
                  <select
                    value={selectedPieDers}
                    onChange={(e) => setSelectedPieDers(e.target.value)}
                    style={{ padding: '5px 10px', fontSize: '14px' }}
                  >
                    <option value="all">Tüm Dersler</option>
                    {dersler.map(ders => (
                      <option key={ders} value={ders}>{ders}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <button onClick={() => exportPng("dybChartBox")}>İndir</button>
          </div>

          {hasItems && dersler.length > 0 && (
            <div style={{ 
              background: selectedPieDers === "all" ? '#e8f5e8' : '#dbeafe',
              padding: '10px', 
              marginBottom: '15px', 
              borderRadius: '4px',
              fontSize: '12px',
              border: selectedPieDers === "all" ? '1px solid #c8e6c9' : '1px solid #93c5fd',
              textAlign: 'center'
            }}>
              <strong>
                {selectedPieDers === "all" 
                  ? "📊 Tüm Dersler - Doğru/Yanlış/Boş Dağılımı" 
                  : `📊 ${selectedPieDers} - Doğru/Yanlış/Boş Dağılımı`}
              </strong>
              <div style={{ marginTop: '5px', fontSize: '11px', color: '#666' }}>
                Toplam {pieDogru + pieYanlis + pieBos} soru
              </div>
            </div>
          )}

          {(pieDogru > 0 || pieYanlis > 0 || pieBos > 0) ? (
            <Pie
              data={{
                labels: ["Doğru", "Yanlış", "Boş"],
                datasets: [
                  {
                    data: [pieDogru, pieYanlis, pieBos],
                    backgroundColor: ["#10b981", "#ef4444", "#6b7280"],
                  },
                ],
              }}
            />
          ) : (
            <p className="grafik-note">Veri bulunamadı</p>
          )}
        </div>

        {/* 3 - Net Puan Gelişimi */}
        <div className="grafik-box" id="netChartBox">
          <div className="grafik-head">
            <h3>Net Puan Gelişimi</h3>
            <button onClick={() => exportPng("netChartBox")}>İndir</button>
          </div>
          {netValues.length > 0 ? (
            <Bar
              data={{
                labels: netLabels,
                datasets: [
                  {
                    label: "Net",
                    data: netValues,
                    backgroundColor: "#764ba2",
                  },
                ],
              }}
            />
          ) : (
            <p className="grafik-note">Net verisi bulunamadı</p>
          )}
        </div>

        {/* 4 - Tüm Oturumlar Başarı */}
        <div className="grafik-box" id="denemeChartBox">
          <div className="grafik-head">
            <h3>Tüm Oturumlar Başarı</h3>
            <button onClick={() => exportPng("denemeChartBox")}>İndir</button>
          </div>
          {denemeBasari.length > 0 ? (
            <Bar
              data={{
                labels: denemeLabels,
                datasets: [
                  {
                    label: "Başarı (%)",
                    data: denemeBasari,
                    backgroundColor: "#6366f1",
                  },
                ],
              }}
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                  },
                },
              }}
            />
          ) : (
            <p className="grafik-note">Oturum verisi bulunamadı</p>
          )}
        </div>

        {/* 5 - Çözüm Süreleri */}
        <div className="grafik-box" id="sureChartBox">
          <div className="grafik-head">
            <h3>Çözüm Süreleri</h3>
            <button onClick={() => exportPng("sureChartBox")}>İndir</button>
          </div>
          {timeValues.some(v => v > 0) ? (
            <Line
              data={{
                labels: timeLabels,
                datasets: [
                  {
                    label: "Süre (sn)",
                    data: timeValues,
                    borderColor: "#f59e0b",
                    backgroundColor: "rgba(245,158,11,0.3)",
                  },
                ],
              }}
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Saniye'
                    }
                  },
                },
              }}
            />
          ) : (
            <div>
              <p className="grafik-note">Süre verisi bulunamadı</p>
              <p style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                Oturumlarda süre bilgisi (durationMs) kaydedilmemiş
              </p>
            </div>
          )}
        </div>

        {/* 6 - Ders Bazlı Performans Dağılımı - DERS SEÇİMLİ */}
        {hasItems && filteredDersData.length > 0 && (
          <div className="grafik-box" id="dersChartBox">
            <div className="grafik-head">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h3>Ders Bazlı Performans Dağılımı</h3>
                <div className="filter-group" style={{ margin: 0 }}>
                  <select
                    value={selectedDers}
                    onChange={(e) => setSelectedDers(e.target.value)}
                    style={{ padding: '5px 10px', fontSize: '14px' }}
                  >
                    <option value="all">Tüm Dersler</option>
                    {dersler.map(ders => (
                      <option key={ders} value={ders}>{ders}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => exportPng("dersChartBox")}>İndir</button>
            </div>

            {/* Ders Bilgisi */}
            <div style={{ 
              background: selectedDers === "all" ? '#e8f5e8' : '#dbeafe',
              padding: '10px', 
              marginBottom: '15px', 
              borderRadius: '4px',
              fontSize: '12px',
              border: selectedDers === "all" ? '1px solid #c8e6c9' : '1px solid #93c5fd',
              textAlign: 'center'
            }}>
              <strong>
                {selectedDers === "all" 
                  ? "📊 Tüm Derslerin Performans Dağılımı" 
                  : `📊 ${selectedDers} Dersi Performansı`}
              </strong>
              <div style={{ marginTop: '5px', fontSize: '11px', color: '#666' }}>
                Toplam {filteredDersData.reduce((sum, d) => sum + d.total, 0)} soru
                {selectedDers === "all" && `, ${filteredDersData.length} ders`}
              </div>
            </div>

            <Bar
              data={{
                labels: filteredDersData.map(d => d.ders),
                datasets: [
                  {
                    label: "Doğru",
                    data: filteredDersData.map(d => d.dogru),
                    backgroundColor: "#10b981",
                  },
                  {
                    label: "Yanlış",
                    data: filteredDersData.map(d => d.yanlis),
                    backgroundColor: "#ef4444",
                  },
                  {
                    label: "Boş",
                    data: filteredDersData.map(d => d.bos),
                    backgroundColor: "#6b7280",
                  },
                ],
              }}
              options={{
                scales: {
                  x: {
                    stacked: true,
                  },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                  },
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      afterLabel: function(context) {
                        const data = filteredDersData[context.dataIndex];
                        return `Başarı: ${data.basariOrani}%`;
                      }
                    }
                  }
                }
              }}
            />

            {/* Detaylı İstatistikler */}
            <div style={{ 
              marginTop: '15px', 
              padding: '15px', 
              background: 'white', 
              borderRadius: '8px',
              fontSize: '14px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h4 style={{ 
                margin: '0 0 12px 0', 
                fontSize: '16px', 
                color: '#1e293b',
                fontWeight: '600',
                borderBottom: '2px solid #f1f5f9',
                paddingBottom: '8px'
              }}>
                📊 İstatistikler
              </h4>
              {filteredDersData.map(ders => (
                <div key={ders.ders} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '8px',
                  padding: '10px 12px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9'
                }}>
                  <span style={{ 
                    fontWeight: '600', 
                    color: '#1e293b',
                    fontSize: '14px'
                  }}>
                    {ders.ders}
                  </span>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span style={{ 
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      <span style={{ color: '#059669' }}>{ders.dogru}✅</span>{' '}
                      <span style={{ color: '#dc2626' }}>{ders.yanlis}❌</span>{' '}
                      <span style={{ color: '#6b7280' }}>{ders.bos}⚪</span>
                    </span>
                    <span style={{ 
                      color: ders.basariOrani >= 70 ? '#059669' : ders.basariOrani >= 50 ? '#d97706' : '#dc2626',
                      fontWeight: '600',
                      fontSize: '14px',
                      background: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${ders.basariOrani >= 70 ? '#a7f3d0' : ders.basariOrani >= 50 ? '#fde68a' : '#fecaca'}`
                    }}>
                      %{ders.basariOrani}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7 - En Çok Soru Çözülen Konular (İlk 15) - DERS SEÇİMLİ */}
        {hasItems && konuData.length > 0 && (
          <div className="grafik-box" id="konuChartBox">
            <div className="grafik-head">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h3>En Çok Soru Çözülen Konular (İlk 15)</h3>
                <div className="filter-group" style={{ margin: 0 }}>
                  <select
                    value={selectedKonuDers}
                    onChange={(e) => setSelectedKonuDers(e.target.value)}
                    style={{ padding: '5px 10px', fontSize: '14px' }}
                  >
                    <option value="all">Tüm Dersler</option>
                    {dersler.map(ders => (
                      <option key={ders} value={ders}>{ders}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => exportPng("konuChartBox")}>İndir</button>
            </div>

            <div style={{ 
              background: selectedKonuDers === "all" ? '#e8f5e8' : '#dbeafe',
              padding: '10px', 
              marginBottom: '15px', 
              borderRadius: '4px',
              fontSize: '12px',
              border: selectedKonuDers === "all" ? '1px solid #c8e6c9' : '1px solid #93c5fd',
              textAlign: 'center'
            }}>
              <strong>
                {selectedKonuDers === "all" 
                  ? "📚 Tüm Derslerde En Çok Çözülen Konular" 
                  : `📚 ${selectedKonuDers} Dersinde En Çok Çözülen Konular`}
              </strong>
            </div>

            <Bar
              data={{
                labels: konuData.map(k => k.konu),
                datasets: [
                  {
                    label: "Doğru",
                    data: konuData.map(k => k.dogru),
                    backgroundColor: "#10b981",
                  },
                  {
                    label: "Yanlış", 
                    data: konuData.map(k => k.yanlis),
                    backgroundColor: "#ef4444",
                  },
                  {
                    label: "Boş",
                    data: konuData.map(k => k.bos),
                    backgroundColor: "#6b7280",
                  },
                ],
              }}
              options={{ 
                indexAxis: "y",
                scales: {
                  x: {
                    stacked: true,
                  },
                  y: {
                    stacked: true,
                  },
                },
              }}
            />
          </div>
        )}

        {/* 8 - En Çok Yanlış Yapılan Konular - DERS SEÇİMLİ */}
        {hasItems && wrongKonular.length > 0 && (
          <div className="grafik-box" id="wrongChartBox">
            <div className="grafik-head">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h3>En Çok Yanlış Yapılan Konular</h3>
                <div className="filter-group" style={{ margin: 0 }}>
                  <select
                    value={selectedYanlisDers}
                    onChange={(e) => setSelectedYanlisDers(e.target.value)}
                    style={{ padding: '5px 10px', fontSize: '14px' }}
                  >
                    <option value="all">Tüm Dersler</option>
                    {dersler.map(ders => (
                      <option key={ders} value={ders}>{ders}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => exportPng("wrongChartBox")}>İndir</button>
            </div>

            <div style={{ 
              background: selectedYanlisDers === "all" ? '#ffe4e6' : '#fee2e2',
              padding: '10px', 
              marginBottom: '15px', 
              borderRadius: '4px',
              fontSize: '12px',
              border: selectedYanlisDers === "all" ? '1px solid #fecaca' : '1px solid #fca5a5',
              textAlign: 'center'
            }}>
              <strong>
                {selectedYanlisDers === "all" 
                  ? "❌ Tüm Derslerde En Çok Yanlış Yapılan Konular" 
                  : `❌ ${selectedYanlisDers} Dersinde En Çok Yanlış Yapılan Konular`}
              </strong>
            </div>

            <Bar
              data={{
                labels: wrongKonular.map(x => x.konu),
                datasets: [
                  {
                    label: "Yanlış",
                    data: wrongKonular.map(x => x.yanlis),
                    backgroundColor: "#dc2626",
                  },
                ],
              }}
              options={{ indexAxis: "y" }}
            />
          </div>
        )}

        {/* 9 - En Çok Boş Bırakılan Konular - DERS SEÇİMLİ */}
        {hasItems && bosKonular.length > 0 && (
          <div className="grafik-box" id="bosChartBox">
            <div className="grafik-head">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h3>En Çok Boş Bırakılan Konular</h3>
                <div className="filter-group" style={{ margin: 0 }}>
                  <select
                    value={selectedBosDers}
                    onChange={(e) => setSelectedBosDers(e.target.value)}
                    style={{ padding: '5px 10px', fontSize: '14px' }}
                  >
                    <option value="all">Tüm Dersler</option>
                    {dersler.map(ders => (
                      <option key={ders} value={ders}>{ders}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => exportPng("bosChartBox")}>İndir</button>
            </div>

            <div style={{ 
              background: selectedBosDers === "all" ? '#f3f4f6' : '#e5e7eb',
              padding: '10px', 
              marginBottom: '15px', 
              borderRadius: '4px',
              fontSize: '12px',
              border: selectedBosDers === "all" ? '1px solid #d1d5db' : '1px solid #9ca3af',
              textAlign: 'center'
            }}>
              <strong>
                {selectedBosDers === "all" 
                  ? "⚪ Tüm Derslerde En Çok Boş Bırakılan Konular" 
                  : `⚪ ${selectedBosDers} Dersinde En Çok Boş Bırakılan Konular`}
              </strong>
            </div>

            <Bar
              data={{
                labels: bosKonular.map(x => x.konu),
                datasets: [
                  {
                    label: "Boş",
                    data: bosKonular.map(x => x.bos),
                    backgroundColor: "#6b7280",
                  },
                ],
              }}
              options={{ indexAxis: "y" }}
            />
          </div>
        )}

        {/* 10 - Zorluk Seviyesi */}
        {hasItems && (zorlukData[0].dogru > 0 || zorlukData[0].yanlis > 0 || zorlukData[0].bos > 0 ||
                     zorlukData[1].dogru > 0 || zorlukData[1].yanlis > 0 || zorlukData[1].bos > 0 ||
                     zorlukData[2].dogru > 0 || zorlukData[2].yanlis > 0 || zorlukData[2].bos > 0) && (
          <div className="grafik-box" id="zorlukChartBox">
            <div className="grafik-head">
              <h3>Zorluk Seviyesi Dağılımı</h3>
              <button onClick={() => exportPng("zorlukChartBox")}>İndir</button>
            </div>
            <Bar
              data={{
                labels: zorlukData.map(z => z.zorluk),
                datasets: [
                  {
                    label: "Doğru",
                    data: zorlukData.map(z => z.dogru),
                    backgroundColor: "#10b981",
                  },
                  {
                    label: "Yanlış",
                    data: zorlukData.map(z => z.yanlis),
                    backgroundColor: "#ef4444",
                  },
                  {
                    label: "Boş",
                    data: zorlukData.map(z => z.bos),
                    backgroundColor: "#6b7280",
                  },
                ],
              }}
              options={{
                scales: {
                  x: {
                    stacked: true,
                  },
                  y: {
                    stacked: true,
                  },
                },
              }}
            />
          </div>
        )}

        {/* Items yoksa bilgilendirme */}
        {!hasItems && (
          <div className="grafik-box" style={{ gridColumn: "1 / -1", textAlign: 'center', padding: '20px' }}>
            <h3>📊 Detaylı Analizler İçin</h3>
            <p>Konu bazlı, ders bazlı ve zorluk seviyesi analizleri için items verisi gerekiyor.</p>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
              Backend'de /api/raporlar/grafikler endpoint'inin implemente edilmesi gerekiyor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}