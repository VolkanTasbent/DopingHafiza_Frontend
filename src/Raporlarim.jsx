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
    // Detay sayfasını aç
    if (onDetayAc) {
      onDetayAc(oturumId);
    }
  };

  const fmt = (d) => (d ? new Date(d).toLocaleString() : "-");
  const fmtMs = (ms) => {
    if (!ms && ms !== 0) return "-";
    const s = Math.floor(ms / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <h2 className="auth-title">📊 Raporlarım</h2>
          <button type="button" onClick={onBack}>
            ← Geri
          </button>
        </div>

        <div className="auth-form">
          {loading && <p>Yükleniyor...</p>}
          {msg && <p style={{ color: "crimson" }}>{msg}</p>}

          {!loading && !list.length && (
            <p>Henüz oturum yok. Bir test çözmeyi deneyebilirsin.</p>
          )}

          <div className="rapor-grid">
            {list.map((row) => {
              const successRate = row.totalCount > 0 
                ? Math.round((row.correctCount / row.totalCount) * 100) 
                : 0;
              
              // Puan hesaplama: Doğru: +4, Yanlış: -1, Boş: 0
              const dogru = row.correctCount ?? 0;
              const yanlis = row.wrongCount ?? 0;
              const toplam = row.totalCount ?? 0;
              const bos = toplam - dogru - yanlis;
              
              const puan = (dogru * 4) + (yanlis * -1) + (bos * 0);
              
              // Net hesaplama: Doğru - (Yanlış / 4)
              const net = dogru - (yanlis / 4);
              const netFormatted = net.toFixed(2);
              
              return (
                <div key={row.oturumId} className="rapor-card">
                  <div className="rapor-card-header">
                    <div className="rapor-score">
                      <span className="score-value">{puan}</span>
                      <span className="score-label">Puan</span>
                    </div>
                    <div className="rapor-badge">
                      <span className={`success-badge ${successRate >= 70 ? 'high' : successRate >= 40 ? 'medium' : 'low'}`}>
                        %{successRate}
                      </span>
                    </div>
                  </div>

                  <div className="rapor-stats-grid">
                    <div className="stat-item success">
                      <span className="stat-icon">✅</span>
                      <span className="stat-value">{row.correctCount ?? 0}</span>
                      <span className="stat-label">Doğru</span>
                    </div>
                    <div className="stat-item error">
                      <span className="stat-icon">❌</span>
                      <span className="stat-value">{row.wrongCount ?? 0}</span>
                      <span className="stat-label">Yanlış</span>
                    </div>
                    <div className="stat-item net">
                      <span className="stat-icon">📊</span>
                      <span className="stat-value">{netFormatted}</span>
                      <span className="stat-label">Net</span>
                    </div>
                    <div className="stat-item total">
                      <span className="stat-icon">🧩</span>
                      <span className="stat-value">{row.totalCount ?? 0}</span>
                      <span className="stat-label">Toplam</span>
                    </div>
                  </div>

                  <div className="rapor-meta">
                    <div className="meta-item">
                      <span className="meta-icon">📅</span>
                      <span className="meta-text">{fmt(row.finishedAt)}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">⏱️</span>
                      <span className="meta-text">{fmtMs(row.durationMs)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => openDetay(row.oturumId)}
                    className="rapor-detay-btn"
                  >
                    <span>📋 Detaylı İncele</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
