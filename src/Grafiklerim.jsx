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
  const [dersFilter, setDersFilter] = useState("all");

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
        netLabels: [],
        netValues: [],
        konuData: [],
        dersData: [],
        wrongKonular: [],
        zorlukData: [],
        timeLabels: [],
        timeValues: [],
        denemeLabels: [],
        denemeBasari: [],
        dersList: [],
        hasItems: false
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

    // 4. Konu Bazlı Başarı
    const konuMap = new Map();
    const hasItems = filtered.some(rapor => rapor.items && rapor.items.length > 0);
    
    if (hasItems) {
      sortedRaporlar.forEach((r) => {
        if (r.items && Array.isArray(r.items)) {
          r.items.forEach((q) => {
            const dogruMu = q.dogruMu !== undefined ? q.dogruMu : 
                           q.correct !== undefined ? q.correct : false;
            const bosMu = q.secenekId === null || q.secenekId === undefined;
            
            const konular = q.soru?.konular || [];
            
            if (konular && konular.length > 0) {
              konular.forEach((k) => {
                if (k && k.ad) {
                  const konuAdi = k.ad.trim();
                  if (!konuMap.has(konuAdi)) {
                    konuMap.set(konuAdi, { dogru: 0, yanlis: 0, bos: 0 });
                  }
                  const konuData = konuMap.get(konuAdi);
                  
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
              if (!konuMap.has(konuAdi)) {
                konuMap.set(konuAdi, { dogru: 0, yanlis: 0, bos: 0 });
              }
              const konuData = konuMap.get(konuAdi);
              
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

    // Konu verilerini sırala ve temizle
    const konuData = Array.from(konuMap.entries())
      .map(([konu, data]) => ({
        konu,
        ...data,
        total: data.dogru + data.yanlis + data.bos,
        basariOrani: data.dogru + data.yanlis > 0 ? 
          Math.round((data.dogru / (data.dogru + data.yanlis)) * 100) : 0
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // 5. Ders Bazlı Başarı
    const dersMap = new Map();
    if (hasItems) {
      sortedRaporlar.forEach((r) => {
        if (r.items && Array.isArray(r.items)) {
          r.items.forEach((q) => {
            const dersAdi = q.soru?.ders?.ad || "Ders Belirtilmemiş";
            const dogruMu = q.dogruMu !== undefined ? q.dogruMu : 
                           q.correct !== undefined ? q.correct : false;
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
          });
        }
      });
    }

    const dersData = Array.from(dersMap.entries())
      .map(([ders, data]) => ({
        ders,
        ...data,
        total: data.dogru + data.yanlis + data.bos,
        basariOrani: data.dogru + data.yanlis > 0 ? 
          Math.round((data.dogru / (data.dogru + data.yanlis)) * 100) : 0
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total);

    // 6. En Çok Yanlış Yapılan Konular
    const wrongKonular = Array.from(konuMap.entries())
      .map(([konu, data]) => ({
        konu,
        yanlis: data.yanlis,
        dogru: data.dogru,
        bos: data.bos,
        total: data.dogru + data.yanlis + data.bos
      }))
      .filter(item => item.yanlis > 0)
      .sort((a, b) => b.yanlis - a.yanlis)
      .slice(0, 10);

    // 7. Zorluk Seviyesi
    const zorlukMap = { 
      kolay: { dogru: 0, yanlis: 0, bos: 0 }, 
      orta: { dogru: 0, yanlis: 0, bos: 0 }, 
      zor: { dogru: 0, yanlis: 0, bos: 0 } 
    };
    
    if (hasItems) {
      sortedRaporlar.forEach((r) => {
        if (r.items && Array.isArray(r.items)) {
          r.items.forEach((q) => {
            const dogruMu = q.dogruMu !== undefined ? q.dogruMu : 
                           q.correct !== undefined ? q.correct : false;
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

    // 8. Süre Analizi
    const timeLabels = sortedRaporlar.map((x, i) => {
      return x.title || x.name || x.denemeAdi || `Oturum ${i + 1}`;
    });

    const timeValues = sortedRaporlar.map((x) => {
      if (x.items && Array.isArray(x.items) && hasItems) {
        const totalMs = x.items.reduce((t, i) => t + (i.elapsedMs || 0), 0);
        return Math.round(totalMs / 1000);
      }
      return Math.round((x.durationMs || 0) / 1000);
    });

    // 9. Oturum Bazlı Başarı
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

    // 10. Ders Listesi
    const dersList = hasItems ? [
      ...new Set(
        Array.from(dersMap.keys()).filter(ders => ders !== "Ders Belirtilmemiş")
      ),
    ] : [];

    console.log("📈 Hesaplanan grafik verileri:", {
      totalDogru,
      totalYanlis,
      totalBos,
      konuSayisi: konuData.length,
      dersSayisi: dersData.length,
      hasItems
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
      dersData,
      wrongKonular,
      zorlukData,
      timeLabels,
      timeValues,
      denemeLabels,
      denemeBasari,
      dersList,
      hasItems
    };
  }, [filtered, raporlar]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [raporlar, dateFilter, dersFilter]);

  const loadData = async () => {
    try {
      // Önce yeni endpoint'i dene
      const { data } = await api.get("/api/raporlar/grafikler", { 
        params: { limit: 200 } 
      });
      
      console.log("📊 Grafik endpoint'inden veriler:", data);
      
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
      console.error("Grafik endpoint başarısız, eski endpoint deneniyor:", e);
      
      // Fallback: Eski endpoint
      try {
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
        console.error("Tüm endpoint'ler başarısız:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let arr = [...raporlar];

    // Tarih filtresi
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

    // Ders filtresi
    if (dersFilter !== "all" && grafikVerileri.hasItems) {
      arr = arr.filter((r) =>
        (r.items || []).some((i) => 
          i.soru?.ders?.ad === dersFilter
        )
      );
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
    wrongKonular,
    zorlukData,
    timeLabels,
    timeValues,
    denemeLabels,
    denemeBasari,
    dersList,
    hasItems
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

      {/* FİLTRE BAR */}
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

        {hasItems && dersList.length > 0 && (
          <div className="filter-group">
            <label>Ders</label>
            <select
              value={dersFilter}
              onChange={(e) => setDersFilter(e.target.value)}
            >
              <option value="all">Tüm Dersler</option>
              {dersList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
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

        {/* 2 - Doğru/Yanlış/Boş Dağılımı */}
        <div className="grafik-box" id="dybChartBox">
          <div className="grafik-head">
            <h3>Doğru - Yanlış - Boş Dağılımı</h3>
            <button onClick={() => exportPng("dybChartBox")}>İndir</button>
          </div>
          {(totalDogru > 0 || totalYanlis > 0 || totalBos > 0) ? (
            <Pie
              data={{
                labels: ["Doğru", "Yanlış", "Boş"],
                datasets: [
                  {
                    data: [totalDogru, totalYanlis, totalBos],
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
          {timeValues.length > 0 ? (
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
            />
          ) : (
            <p className="grafik-note">Süre verisi bulunamadı</p>
          )}
        </div>

        {/* 6 - Ders Bazlı Performans */}
        {hasItems && dersData.length > 0 && (
          <div className="grafik-box" id="dersChartBox">
            <div className="grafik-head">
              <h3>Ders Bazlı Performans</h3>
              <button onClick={() => exportPng("dersChartBox")}>İndir</button>
            </div>
            <Bar
              data={{
                labels: dersData.map(d => d.ders),
                datasets: [
                  {
                    label: "Doğru",
                    data: dersData.map(d => d.dogru),
                    backgroundColor: "#10b981",
                  },
                  {
                    label: "Yanlış",
                    data: dersData.map(d => d.yanlis),
                    backgroundColor: "#ef4444",
                  },
                  {
                    label: "Boş",
                    data: dersData.map(d => d.bos),
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

        {/* 7 - Konu Bazlı Performans */}
        {hasItems && konuData.length > 0 && (
          <div className="grafik-box" id="konuChartBox">
            <div className="grafik-head">
              <h3>En Çok Soru Çözülen Konular (İlk 15)</h3>
              <button onClick={() => exportPng("konuChartBox")}>İndir</button>
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

        {/* 8 - En Çok Yanlış Yapılan Konular */}
        {hasItems && wrongKonular.length > 0 && (
          <div className="grafik-box" id="wrongChartBox">
            <div className="grafik-head">
              <h3>En Çok Yanlış Yapılan Konular</h3>
              <button onClick={() => exportPng("wrongChartBox")}>İndir</button>
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

        {/* 9 - Zorluk Seviyesi */}
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