// src/RaporDetay.jsx
import React, { useEffect, useState, useMemo } from "react";
import api, { fileUrl } from "./services/api";
import "./Raporlarim.css";

import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

export default function RaporDetay({ oturumId, onBack }) {
  const [tumSorular, setTumSorular] = useState([]);
  const [detayVeri, setDetayVeri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [sadeceyanlisGoster, setSadeceyanlisGoster] = useState(true);
  const [activeTab, setActiveTab] = useState("detay");

  const errText = (e) =>
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    e?.message ||
    "Hata";

  // ---------------------------------------------------
  // SORU ANALİZİ
  // ---------------------------------------------------
  const analyzeItem = (item) => {
    const s = item.soru;
    if (!s || !Array.isArray(s.secenekler)) {
      return {
        soru: s,
        chosen: null,
        correct: null,
        isBlank: true,
        isCorrect: false,
      };
    }

    const secenekId = item.secenekId;
    let chosen = s.secenekler.find((x) => x.id === secenekId);

    if (!chosen && secenekId !== null && secenekId !== undefined) {
      if (!isNaN(secenekId)) {
        const index = Number(secenekId) - 1;
        if (index >= 0 && index < s.secenekler.length) chosen = s.secenekler[index];
      }
    }

    const correct =
      s.secenekler.find((x) => x.dogru === true || x.dogru === 1) || null;

    const isBlank = chosen == null;

    let isCorrect = false;

    if (!isBlank && chosen && correct) {
      if (chosen.id != null && correct.id != null) {
        isCorrect = chosen.id === correct.id;
      } else {
        const ci = s.secenekler.indexOf(chosen);
        const di = s.secenekler.indexOf(correct);
        isCorrect = ci === di && ci !== -1;
      }
    }

    return { soru: s, chosen, correct, isBlank, isCorrect, secenekId };
  };

  // ---------------------------------------------------
  // DETAY YÜKLEME
  // ---------------------------------------------------
  useEffect(() => {
    const loadDetay = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/api/raporlar/${oturumId}/detay`);
        setTumSorular(data?.items || []);
      } catch (e) {
        setMsg("Detay alınamadı: " + errText(e));
      } finally {
        setLoading(false);
      }
    };

    loadDetay();
  }, [oturumId]);

  // ---------------------------------------------------
  // FİLTRE ÇALIŞMASI (YANLIŞ/TÜM SORULAR)
  // ---------------------------------------------------
  useEffect(() => {
    if (!tumSorular.length) {
      setDetayVeri([]);
      return;
    }

    const yeni = tumSorular.filter((it) => {
      const { soru, isBlank, isCorrect } = analyzeItem(it);

      // seçeneksiz sorular Tüm Sorular'da görünmeli
      if (!soru || !Array.isArray(soru.secenekler)) return !sadeceyanlisGoster;

      if (sadeceyanlisGoster) return !isBlank && !isCorrect;

      return true;
    });

    setDetayVeri(yeni);
  }, [sadeceyanlisGoster, tumSorular]);

  const yanlisSayisi = useMemo(
    () =>
      tumSorular.filter((it) => {
        const { soru, isBlank, isCorrect } = analyzeItem(it);
        if (!soru || !Array.isArray(soru.secenekler)) return false;
        return !isBlank && !isCorrect;
      }).length,
    [tumSorular]
  );

  // ---------------------------------------------------
  // 🔥 GRAFİK HESAPLARI
  // ---------------------------------------------------
  const grafikVerileri = useMemo(() => {
    if (!tumSorular.length) return null;

    const analiz = tumSorular.map((x) => analyzeItem(x));

    let d = 0,
      y = 0,
      b = 0;

    const dersMap = {};
    const konuMap = {}; // sadece konular

    analiz.forEach((a) => {
      const s = a.soru;
      if (!s) return;

      const dersAd = s.dersAd || s.ders?.ad || "Genel";

      if (a.isBlank) b++;
      else if (a.isCorrect) d++;
      else y++;

      // ----- DERS BAZLI -----
      if (!dersMap[dersAd])
        dersMap[dersAd] = { dogru: 0, yanlis: 0, bos: 0 };

      if (a.isBlank) dersMap[dersAd].bos++;
      else if (a.isCorrect) dersMap[dersAd].dogru++;
      else dersMap[dersAd].yanlis++;

      // ----- KONU BAZLI -----
      // konu yoksa buraya hiç ekleme (ders adı fallback YOK)
      if (Array.isArray(s.konular) && s.konular.length > 0) {
        s.konular.forEach((k) => {
          if (!konuMap[k.ad]) konuMap[k.ad] = { dogru: 0, yanlis: 0, bos: 0 };

          if (a.isBlank) konuMap[k.ad].bos++;
          else if (a.isCorrect) konuMap[k.ad].dogru++;
          else konuMap[k.ad].yanlis++;
        });
      }
    });

    const wrongSorted = Object.keys(konuMap)
      .map((k) => ({ konu: k, yanlis: konuMap[k].yanlis }))
      .sort((a, b) => b.yanlis - a.yanlis)
      .slice(0, 10);

    return {
      dogruTop: d,
      yanlisTop: y,
      bosTop: b,
      dersMap,
      dersLabels: Object.keys(dersMap),
      wrongSorted,
    };
  }, [tumSorular]);

  const toplamSoru = tumSorular.length;

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------
  return (
    <div className="rapor-detay-container">
      {/* HEADER */}
      <div className="rapor-detay-header">
        <div className="detay-header-content">
          <h1 className="detay-main-title">Test Detayları</h1>
          <p className="detay-subtitle-text">
            Soruları inceleyin ve grafiksel analiz görün
          </p>
        </div>
        <button onClick={onBack} className="detay-back-button">
          Geri Dön
        </button>
      </div>

      {/* SEGMENTED CONTROL */}
      {!loading && toplamSoru > 0 && (
        <div className="segmented-control">
          <button
            className={`segment-btn ${
              activeTab === "detay" ? "segment-active" : ""
            }`}
            onClick={() => setActiveTab("detay")}
          >
            Detaylar
          </button>

          <button
            className={`segment-btn ${
              activeTab === "grafik" ? "segment-active" : ""
            }`}
            onClick={() => setActiveTab("grafik")}
          >
            Raporun Grafikleri
          </button>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* DETAY */}
      {/* -------------------------------------------------- */}
      {activeTab === "detay" && (
        <>
          {!loading && (
            <div className="filter-buttons-container">
              <button
                onClick={() => setSadeceyanlisGoster(false)}
                className={`filter-btn ${!sadeceyanlisGoster ? "active" : ""}`}
              >
                Tüm Sorular ({toplamSoru})
              </button>

              <button
                onClick={() => setSadeceyanlisGoster(true)}
                className={`filter-btn filter-btn-danger ${
                  sadeceyanlisGoster ? "active" : ""
                }`}
              >
                Yanlış Cevaplar ({yanlisSayisi})
              </button>
            </div>
          )}

          <div className="soru-detay-listesi">
            {detayVeri.map((it, i) => {
              const { soru: s, chosen, correct, isBlank, isCorrect } =
                analyzeItem(it);

              return (
                <div key={i} className="soru-detay-modern-card">
                  <div className="soru-number-header">
                    <div className="soru-number-box">
                      <span>Soru {i + 1}</span>
                      <span
                        className={`soru-status-badge ${
                          isCorrect
                            ? "status-correct"
                            : isBlank
                            ? "status-blank"
                            : "status-wrong"
                        }`}
                      >
                        {isCorrect
                          ? "Doğru"
                          : isBlank
                          ? "Boş"
                          : "Yanlış"}
                      </span>
                    </div>

                    {/* 🔙 ESKİ HALİ GERİ DÖNDÜ: DERS + KONU ETİKETLERİ */}
                    <div className="soru-tags-modern">
                      <span className="tag-modern tag-ders">
                        {s?.dersAd || s?.ders?.ad || "-"}
                      </span>
                      {Array.isArray(s?.konular) &&
                        s.konular.map((k, idx) => (
                          <span key={idx} className="tag-modern tag-konu">
                            {k.ad}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="soru-metin-modern">
                    <div className="soru-metin-label">Soru Metni</div>
                    <div className="soru-metin-content">{s?.metin}</div>
                  </div>

                  <div className="cevap-karsilastirma-modern">
                    <div
                      className={`cevap-kutu ${
                        isCorrect
                          ? "cevap-dogru-kutu"
                          : isBlank
                          ? "cevap-bos-kutu"
                          : "cevap-yanlis-kutu"
                      }`}
                    >
                      <span className="cevap-kutu-title">Senin Cevabın</span>
                      <div className="cevap-kutu-content">
                        {isBlank ? "Boş bıraktın" : chosen?.metin}
                      </div>
                    </div>

                    {!isCorrect && (
                      <div className="cevap-kutu cevap-dogru-kutu">
                        <span className="cevap-kutu-title">Doğru Cevap</span>
                        <div className="cevap-kutu-content">
                          {correct?.metin}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* -------------------------------------------------- */}
      {/* GRAFİK */}
      {/* -------------------------------------------------- */}
      {activeTab === "grafik" && grafikVerileri && (
        <div className="rapor-grafik-panel">
          <div className="rapor-grafik-grid">
            {/* 1 - Genel dağılım */}
            <div className="grafik-box">
              <h3>Doğru / Yanlış / Boş</h3>
              <Pie
                data={{
                  labels: ["Doğru", "Yanlış", "Boş"],
                  datasets: [
                    {
                      data: [
                        grafikVerileri.dogruTop,
                        grafikVerileri.yanlisTop,
                        grafikVerileri.bosTop,
                      ],
                      backgroundColor: ["#10b981", "#ef4444", "#9ca3af"],
                    },
                  ],
                }}
              />
            </div>

            {/* 2 - Yanlış yapılan konular */}
            <div className="grafik-box">
              <h3>En Çok Yanlış Yapılan Konular</h3>
              <Bar
                data={{
                  labels: grafikVerileri.wrongSorted.map((x) => x.konu),
                  datasets: [
                    {
                      label: "Yanlış",
                      data: grafikVerileri.wrongSorted.map((x) => x.yanlis),
                      backgroundColor: "#dc2626",
                    },
                  ],
                }}
                options={{ indexAxis: "y" }}
              />
            </div>

            {/* 3 - Ders bazlı doğru/yanlış */}
            <div className="grafik-box">
              <h3>Ders Bazlı Başarı</h3>
              <Bar
                data={{
                  labels: grafikVerileri.dersLabels,
                  datasets: [
                    {
                      label: "Doğru",
                      data: grafikVerileri.dersLabels.map(
                        (d) => grafikVerileri.dersMap[d].dogru
                      ),
                      backgroundColor: "#3b82f6",
                    },
                    {
                      label: "Yanlış",
                      data: grafikVerileri.dersLabels.map(
                        (d) => grafikVerileri.dersMap[d].yanlis
                      ),
                      backgroundColor: "#ef4444",
                    },
                  ],
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
