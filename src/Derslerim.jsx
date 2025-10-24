// src/Derslerim.jsx
import { useEffect, useState } from "react";
import api from "./services/api";
import "./Derslerim.css";

export default function Derslerim({ onStartQuiz, onDersDetay }) {
  const [dersler, setDersler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/ders");
        setDersler(data || []);
        const rapor = await api.get("/api/raporlar", { params: { limit: 100 } });
        const totalSolved = rapor.data.reduce((s, r) => s + (r.totalCount || 0), 0);
        const correctAnswers = rapor.data.reduce((s, r) => s + (r.correctCount || 0), 0);
        const successRate = totalSolved > 0 ? Math.round((correctAnswers / totalSolved) * 100) : 0;
        setStats({ totalSolved, correctAnswers, successRate });
      } catch (err) {
        console.error("Dersler alınamadı:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="ders-loading">⏳ Dersler yükleniyor...</div>;
  }

  return (
    <div className="dersler-container">
      <header className="ders-header">
        <h1>📚 Derslerim</h1>
        <div className="istatistikler">
          <div>✅ Doğru: {stats.correctAnswers}</div>
          <div>📊 Oran: %{stats.successRate}</div>
          <div>🧠 Çözülen: {stats.totalSolved}</div>
        </div>
      </header>

      <div className="ders-grid">
        {dersler.map((ders) => (
          <div key={ders.id} className="ders-card">
            <div className="ders-banner">
              <div className="ders-icon">{ders.ad.charAt(0).toUpperCase()}</div>
              <h3>{ders.ad}</h3>
              <p>{ders.aciklama || "Ders açıklaması yakında"}</p>
            </div>
            <div className="ders-buttons">
              <button className="btn-primary" onClick={() => onStartQuiz?.(ders.id, ders.ad)}>
                🚀 Teste Başla
              </button>
              <button className="btn-secondary" onClick={() => onDersDetay?.(ders)}>
                🎬 Detay
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
