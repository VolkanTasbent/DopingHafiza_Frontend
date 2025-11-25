// src/Raporlarim.jsx
import React, { useEffect, useState } from "react";
import api from "./services/api";
import "./AuthPage.css";
import "./Raporlarim.css";

export default function Raporlarim({ onBack, onDetayAc }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const errText = (e) =>
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    (typeof e?.response?.data === "string" ? e.response.data : "") ||
    e?.message ||
    "Hata";

  useEffect(() => {
    (async () => {
      try {
        setMsg("");
        setLoading(true);
        const { data } = await api.get("/api/raporlar", { params: { limit: 100 } });
        
        // Yeniden eskiye sıralama (finishedAt'e göre)
        const sortedData = Array.isArray(data) 
          ? data.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
          : [];
        
        setList(sortedData);
      } catch (e) {
        setMsg("Oturumlar alınamadı: " + errText(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openDetay = (oturumId) => {
    if (onDetayAc) {
      onDetayAc(oturumId);
    }
  };

  const fmt = (d) => (d ? new Date(d).toLocaleString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) : "-");
  
  const fmtMs = (ms) => {
    if (!ms && ms !== 0) return "-";
    const s = Math.floor(ms / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  if (loading) {
    return (
      <div className="raporlar-container">
        <div className="raporlar-loading">
          <div className="loading-spinner"></div>
          <p>Raporlar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="raporlar-container">
      <div className="raporlar-header">
        <div className="raporlar-title-section">
          <h1 className="raporlar-title">Raporlarım</h1>
          <p className="raporlar-subtitle">Test sonuçlarınızı ve performans analizinizi görüntüleyin</p>
        </div>
        {onBack && (
          <button className="back-button" onClick={onBack}>
            Geri
          </button>
        )}
        <button className="back-button" onClick={() => setSayfa("grafikler")}>
  Grafikler
</button>

      </div>

      {msg && (
        <div className="error-message">
          <span className="error-icon">!</span>
          <span>{msg}</span>
        </div>
      )}

      {!loading && !list.length && (
        <div className="empty-state-raporlar">
          <div className="empty-icon-large"></div>
          <h3>Henüz rapor bulunmuyor</h3>
          <p>İlk testinizi çözerek raporlarınızı görmeye başlayın</p>
        </div>
      )}

      {list.length > 0 && (
        <div className="rapor-grid">
          {list.map((row) => {
            const successRate = row.totalCount > 0 
              ? Math.round((row.correctCount / row.totalCount) * 100) 
              : 0;
            
            const dogru = row.correctCount ?? 0;
            const yanlis = row.wrongCount ?? 0;
            const toplam = row.totalCount ?? 0;
            const bos = toplam - dogru - yanlis;
            
            // Net hesaplama: Doğru - (Yanlış / 4)
            // PUAN KALDIRILDI - Sadece Net gösteriliyor
            const net = dogru - (yanlis / 4);
            const netFormatted = net.toFixed(2);
            
            // Backend'den gelen score değeri kullanılmıyor - sadece Net gösteriliyor
            
            return (
              <div key={row.oturumId} className="rapor-card">
                <div className="rapor-card-header">
                  <div className="rapor-badge">
                    <span className={`success-badge ${successRate >= 70 ? 'high' : successRate >= 40 ? 'medium' : 'low'}`}>
                      %{successRate} Başarı
                    </span>
                  </div>
                </div>

                <div className="rapor-stats-grid">
                  <div className="stat-item total">
                    <span className="stat-value">{row.totalCount ?? 0}</span>
                    <span className="stat-label">Soru Sayısı</span>
                  </div>
                  <div className="stat-item success">
                    <span className="stat-value">{row.correctCount ?? 0}</span>
                    <span className="stat-label">Doğru</span>
                  </div>
                  <div className="stat-item error">
                    <span className="stat-value">{row.wrongCount ?? 0}</span>
                    <span className="stat-label">Yanlış</span>
                  </div>
                  <div className="stat-item blank">
                    <span className="stat-value">{bos}</span>
                    <span className="stat-label">Boş</span>
                  </div>
                  <div className="stat-item net">
                    <span className="stat-value">{netFormatted}</span>
                    <span className="stat-label">Net</span>
                  </div>
                </div>

                <div className="rapor-meta">
                  <div className="meta-item">
                    <span className="meta-label">Tarih</span>
                    <span className="meta-text">{fmt(row.finishedAt)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Süre</span>
                    <span className="meta-text">{fmtMs(row.durationMs)}</span>
                  </div>
                </div>

                <button
                  onClick={() => openDetay(row.oturumId)}
                  className="rapor-detay-btn"
                >
                  Detaylı İncele
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
