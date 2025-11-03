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
    return (
      <div className="ders-loading-wrapper">
        <div className="ders-loading">
          <div className="loading-spinner"></div>
          <p>Dersler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dersler-container">
      {/* Hero Section */}
      <div className="dersler-hero">
        <div className="hero-content">
          <h1 className="hero-title">Derslerim</h1>
          <p className="hero-subtitle">Eğitim yolculuğunuza devam edin ve bilginizi test edin</p>
        </div>
        
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-success">
            <div className="stat-icon stat-icon-check"></div>
            <div className="stat-content">
              <div className="stat-value">{stats.correctAnswers || 0}</div>
              <div className="stat-label">Doğru Cevap</div>
            </div>
          </div>
          
          <div className="stat-card stat-primary">
            <div className="stat-icon stat-icon-chart"></div>
            <div className="stat-content">
              <div className="stat-value">%{stats.successRate || 0}</div>
              <div className="stat-label">Başarı Oranı</div>
            </div>
          </div>
          
          <div className="stat-card stat-info">
            <div className="stat-icon stat-icon-brain"></div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalSolved || 0}</div>
              <div className="stat-label">Çözülen Soru</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dersler Grid */}
      <div className="ders-grid-section">
        <h2 className="section-title">Tüm Dersler</h2>
        <div className="ders-grid">
          {dersler.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"></div>
              <h3>Henüz ders eklenmemiş</h3>
              <p>Yakında dersler burada görünecek</p>
            </div>
          ) : (
            dersler.map((ders) => (
              <div key={ders.id} className="ders-card">
                <div className="ders-card-header">
                  <div className="ders-icon-wrapper">
                    <div className="ders-icon">{ders.ad.charAt(0).toUpperCase()}</div>
                  </div>
                  <div className="ders-card-badge">Ders</div>
                </div>
                
                <div className="ders-card-body">
                  <h3 className="ders-card-title">{ders.ad}</h3>
                  <p className="ders-card-description">
                    {ders.aciklama || "Ders açıklaması yakında eklenecek"}
                  </p>
                </div>
                
                <div className="ders-card-footer">
                  <button 
                    className="btn-primary" 
                    onClick={() => onStartQuiz?.(ders.id, ders.ad)}
                  >
                    <span>Teste Başla</span>
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => onDersDetay?.(ders)}
                  >
                    <span>Detaylar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
