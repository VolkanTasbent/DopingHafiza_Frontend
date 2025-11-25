// src/Grafiklerim.jsx
import React, { useEffect, useState } from "react";
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
import "./Raporlarim.css"; // Raporlarim ile aynı tasarım

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

// Bir raporun "deneme" olup olmadığını anlamak için yardımcı fonksiyon
// Backend'den hangi alanlar geliyorsa ona göre otomatik yakalamaya çalışıyor.
// Eğer hiçbiri yoksa hepsi "Normal Test" gibi davranır, bozulmaz.
function isDenemeRapor(r) {
  return (
    r.denemeId != null ||
    r.denemeAdi != null ||
    r.deneme === true ||
    r.raporType === "DENEME" ||
    r.type === "DENEME"
  );
}

export default function Grafiklerim({ onBack }) {
  const [raporlar, setRaporlar] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dateFilter, setDateFilter] = useState("all");   // all | 7 | 30
  const [dersFilter, setDersFilter] = useState("all");   // all | dersAd
  const [typeFilter, setTypeFilter] = useState("all");   // all | test | deneme

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [raporlar, dateFilter, dersFilter]);

  const loadData = async () => {
    try {
      const { data } = await api.get("/api/raporlar", { params: { limit: 200 } });
      setRaporlar(data || []);
    } catch (e) {
      console.error("Veriler yüklenemedi:", e);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let arr = [...raporlar];

    // 📅 Tarih filtresi
    if (dateFilter !== "all") {
      const now = Date.now();
      const days = dateFilter === "7" ? 7 : 30;

      arr = arr.filter((r) => {
        if (!r.finishedAt) return false;
        const t = new Date(r.finishedAt).getTime();
        return now - t <= days * 24 * 60 * 60 * 1000;
      });
    }

    // 📘 Ders filtresi
    if (dersFilter !== "all") {
      arr = arr.filter((r) =>
        r.items?.some((i) => i.soru?.ders?.ad === dersFilter)
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
      <div className="empty-state-raporlar">
        <h3>Grafik oluşturmak için test çözmelisin</h3>
      </div>
    );
  }

  // -----------------------------------
  // 🔥 AKTİF LİSTE (Tür filtresine göre)
  // -----------------------------------
  const activeRaporlar = filtered.filter((r) => {
    const denemeMi = isDenemeRapor(r);
    if (typeFilter === "test") return !denemeMi;
    if (typeFilter === "deneme") return denemeMi;
    return true; // all
  });

  if (!activeRaporlar.length) {
    return (
      <div className="raporlar-container">
        <div className="raporlar-header">
          <div className="raporlar-title-section">
            <h1 className="raporlar-title">Grafiklerim</h1>
            <p className="raporlar-subtitle">
              Seçilen filtrelere uygun rapor bulunamadı.
            </p>
          </div>
          {onBack && (
            <button className="back-button" onClick={onBack}>
              ← Geri
            </button>
          )}
        </div>

        <div className="empty-state-raporlar">
          <h3>Bu filtrelerle eşleşen test/deneme yok</h3>
        </div>
      </div>
    );
  }

  // ---------------------------
  // 🔥 GRAFİK HESAPLAMALARI
  // ---------------------------

  // Son 10 oturum (en güncel üstteyse slice(0,10).reverse ile kronolojik)
  const last10 = activeRaporlar.slice(0, 10).reverse();

  const lineLabels = last10.map((x) =>
    x.finishedAt
      ? new Date(x.finishedAt).toLocaleDateString("tr-TR")
      : "?"
  );

  const lineData = last10.map((x) => {
    const dogru = x.correctCount || 0;
    const total = x.totalCount || 0;
    return total > 0 ? Math.round((dogru / total) * 100) : 0;
  });

  // Toplam doğru - yanlış
  const totalDogru = activeRaporlar.reduce(
    (t, x) => t + (x.correctCount || 0),
    0
  );
  const totalYanlis = activeRaporlar.reduce(
    (t, x) => t + (x.wrongCount || 0),
    0
  );

  // Net gelişimi
  const netLabels = last10.map((x) =>
    x.finishedAt
      ? new Date(x.finishedAt).toLocaleDateString("tr-TR")
      : "?"
  );
  const netValues = last10.map((x) => {
    const dogru = x.correctCount || 0;
    const yanlis = x.wrongCount || 0;
    const net = dogru - yanlis / 4;
    return net.toFixed(2);
  });

  // Konu bazlı başarı
  const konuMap = {};
  activeRaporlar.forEach((r) => {
    (r.items || []).forEach((q) => {
      const dogruMu = q.dogruMu || q.correct === true;
      const konular = q.soru?.konular || [];
      konular.forEach((k) => {
        if (!k?.ad) return;
        if (!konuMap[k.ad]) konuMap[k.ad] = { dogru: 0, yanlis: 0 };
        if (dogruMu) konuMap[k.ad].dogru++;
        else konuMap[k.ad].yanlis++;
      });
    });
  });

  const konuLabels = Object.keys(konuMap);
  const konuDogru = konuLabels.map((k) => konuMap[k].dogru);
  const konuYanlis = konuLabels.map((k) => konuMap[k].yanlis);

  // Ders bazlı başarı
  const dersMap = {};
  activeRaporlar.forEach((r) => {
    (r.items || []).forEach((q) => {
      const ders = q.soru?.ders?.ad;
      if (!ders) return;
      const dogruMu = q.dogruMu || q.correct === true;
      if (!dersMap[ders]) dersMap[ders] = { dogru: 0, yanlis: 0 };
      if (dogruMu) dersMap[ders].dogru++;
      else dersMap[ders].yanlis++;
    });
  });

  const dersLabels = Object.keys(dersMap);
  const dersDogru = dersLabels.map((d) => dersMap[d].dogru);
  const dersYanlis = dersLabels.map((d) => dersMap[d].yanlis);

  // En çok yanlış yapılan konular (TOP 10)
  const wrongSorted = konuLabels
    .map((k) => ({ konu: k, yanlis: konuMap[k].yanlis }))
    .sort((a, b) => b.yanlis - a.yanlis)
    .slice(0, 10);

  // Zorluk seviyesi başarısı (sadece doğru sayıyor)
  const zMap = { kolay: 0, orta: 0, zor: 0 };
  activeRaporlar.forEach((r) =>
    (r.items || []).forEach((q) => {
      const z = (q.soru?.zorluk || "orta").toString().toLowerCase();
      if (!q.dogruMu && q.correct !== true) return;
      if (z.includes("kolay")) zMap.kolay++;
      else if (z.includes("zor")) zMap.zor++;
      else zMap.orta++;
    })
  );

  // Süre analizi (toplam çözüm süresi sn)
  const timeLabels = activeRaporlar.map(
    (x, i) => x.title || x.name || `Oturum ${i + 1}`
  );
  const timeValues = activeRaporlar.map((x) => {
    const totalMs = (x.items || []).reduce(
      (t, i) => t + (i.elapsedMs || 0),
      0
    );
    return Math.round(totalMs / 1000);
  });

  // Deneme / oturum bazlı başarı (burayı hem test hem deneme için kullanıyoruz)
  const denemeLabels = activeRaporlar.map(
    (r, i) =>
      r.title ||
      r.name ||
      r.denemeAdi ||
      r.denemeTitle ||
      `Oturum ${i + 1}`
  );
  const denemeBasari = activeRaporlar.map((r) => {
    const dogru = r.correctCount || 0;
    const total = r.totalCount || 0;
    return total > 0 ? Math.round((dogru / total) * 100) : 0;
  });

  // Ders listesi (ders filtresi dropdown için)
  const dersList = [
    ...new Set(
      raporlar
        .flatMap((r) => (r.items || []).map((i) => i.soru?.ders?.ad))
        .filter(Boolean)
    ),
  ];

  // ---------------------------
  // 🔥 RENDER BAŞLANGICI
  // ---------------------------

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

      {/* 📌 FİLTRE BAR */}
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

        <div className="filter-group">
          <label>Tür</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Hepsi</option>
            <option value="test">Normal Testler</option>
            <option value="deneme">Deneme Sınavları</option>
          </select>
        </div>
      </div>

      {/* TÜM GRAFİKLER */}
      <div className="grafik-panel">
        {/* 1 - Son 10 Oturum Başarı */}
        <div className="grafik-box" id="son10ChartBox">
          <div className="grafik-head">
            <h3>Son 10 Oturum Başarı</h3>
            <button onClick={() => exportPng("son10ChartBox")}>İndir</button>
          </div>
          <Line
            data={{
              labels: lineLabels,
              datasets: [
                {
                  label: "Başarı (%)",
                  data: lineData,
                  borderColor: "#667eea",
                  backgroundColor: "rgba(102,126,234,0.3)",
                },
              ],
            }}
          />
        </div>

        {/* 2 - Doğru Yanlış Dağılımı */}
        <div className="grafik-box" id="dyChartBox">
          <div className="grafik-head">
            <h3>Doğru - Yanlış Dağılımı</h3>
            <button onClick={() => exportPng("dyChartBox")}>İndir</button>
          </div>
          <Pie
            data={{
              labels: ["Doğru", "Yanlış"],
              datasets: [
                {
                  data: [totalDogru, totalYanlis],
                  backgroundColor: ["#10b981", "#ef4444"],
                },
              ],
            }}
          />
        </div>

        {/* 3 - Net Gelişimi */}
        <div className="grafik-box" id="netChartBox">
          <div className="grafik-head">
            <h3>Net Puan Gelişimi</h3>
            <button onClick={() => exportPng("netChartBox")}>İndir</button>
          </div>
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
        </div>

        {/* 4 - Konu Bazlı Başarı */}
        <div className="grafik-box" id="konuChartBox">
          <div className="grafik-head">
            <h3>Konu Bazlı Başarı</h3>
            <button onClick={() => exportPng("konuChartBox")}>İndir</button>
          </div>
          <Bar
            data={{
              labels: konuLabels,
              datasets: [
                {
                  label: "Doğru",
                  data: konuDogru,
                  backgroundColor: "#10b981",
                },
                {
                  label: "Yanlış",
                  data: konuYanlis,
                  backgroundColor: "#ef4444",
                },
              ],
            }}
            options={{ indexAxis: "y" }}
          />
        </div>

        {/* 5 - Ders Bazlı Başarı */}
        <div className="grafik-box" id="dersChartBox">
          <div className="grafik-head">
            <h3>Ders Bazlı Başarı</h3>
            <button onClick={() => exportPng("dersChartBox")}>İndir</button>
          </div>
          <Bar
            data={{
              labels: dersLabels,
              datasets: [
                {
                  label: "Doğru",
                  data: dersDogru,
                  backgroundColor: "#3b82f6",
                },
                {
                  label: "Yanlış",
                  data: dersYanlis,
                  backgroundColor: "#ef4444",
                },
              ],
            }}
          />
        </div>

        {/* 6 - En Çok Yanlış Yapılan Konular */}
        <div className="grafik-box" id="wrongChartBox">
          <div className="grafik-head">
            <h3>En Çok Yanlış Yapılan Konular</h3>
            <button onClick={() => exportPng("wrongChartBox")}>İndir</button>
          </div>
          <Bar
            data={{
              labels: wrongSorted.map((x) => x.konu),
              datasets: [
                {
                  label: "Yanlış",
                  data: wrongSorted.map((x) => x.yanlis),
                  backgroundColor: "#dc2626",
                },
              ],
            }}
            options={{ indexAxis: "y" }}
          />
        </div>

        {/* 7 - Toplam Çözüm Süresi */}
        <div className="grafik-box" id="sureChartBox">
          <div className="grafik-head">
            <h3>Toplam Çözüm Süresi</h3>
            <button onClick={() => exportPng("sureChartBox")}>İndir</button>
          </div>
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
        </div>

        {/* 8 - Zorluk Seviyesi Başarı */}
        <div className="grafik-box" id="zorlukChartBox">
          <div className="grafik-head">
            <h3>Zorluk Seviyesi (Doğru Sayısı)</h3>
            <button onClick={() => exportPng("zorlukChartBox")}>İndir</button>
          </div>
          <Pie
            data={{
              labels: ["Kolay", "Orta", "Zor"],
              datasets: [
                {
                  data: [zMap.kolay, zMap.orta, zMap.zor],
                  backgroundColor: ["#22c55e", "#3b82f6", "#a855f7"],
                },
              ],
            }}
          />
        </div>

        {/* 9 - Oturum / Deneme Bazlı Başarı */}
        <div className="grafik-box" id="denemeChartBox">
          <div className="grafik-head">
            <h3>{typeFilter === "deneme" ? "Deneme Bazlı Başarı" : "Oturum Bazlı Başarı"}</h3>
            <button onClick={() => exportPng("denemeChartBox")}>İndir</button>
          </div>
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
          />
        </div>
      </div>
    </div>
  );
}
