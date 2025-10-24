// src/DersDetay.jsx
import { useEffect, useState } from "react";
import api from "./services/api";
import "./DersDetay.css";

export default function DersDetay({ ders, onBack }) {
  const [konular, setKonular] = useState([]);
  const [videolar, setVideolar] = useState([]);
  const [aktifTab, setAktifTab] = useState("konular");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ders?.id) {
      fetchKonular();
      fetchVideolar();
    }
  }, [ders]);

  const fetchKonular = async () => {
    try {
      const { data } = await api.get("/api/konu", { params: { dersId: ders.id } });
      setKonular(data || []);
    } catch {
      setKonular([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVideolar = async () => {
    // Şimdilik örnek veri; backend'e video tablosu eklenince buradan çekilir
    setVideolar([
      { id: 1, baslik: "Giriş Videosu", url: "https://www.youtube.com/embed/5qap5aO4i9A" },
      { id: 2, baslik: "Konu 1: Temel Kavramlar", url: "https://www.youtube.com/embed/f02mOEt11OQ" },
    ]);
  };

  if (loading) return <div className="ders-loading">⏳ Ders detayları yükleniyor...</div>;

  return (
    <div className="ders-detay">
      <div className="ders-header">
        <h2>{ders.ad}</h2>
        <button onClick={onBack} className="geri-btn">← Geri</button>
      </div>

      <nav className="tablar">
        {["konular", "videolar", "istatistikler"].map((t) => (
          <button
            key={t}
            className={aktifTab === t ? "aktif" : ""}
            onClick={() => setAktifTab(t)}
          >
            {t === "konular" && "📖 Konular"}
            {t === "videolar" && "🎥 Videolar"}
            {t === "istatistikler" && "📊 İstatistikler"}
          </button>
        ))}
      </nav>

      <div className="icerik">
        {aktifTab === "konular" && (
          <div className="konu-listesi">
            {konular.map((k) => (
              <div key={k.id} className="konu-card">
                <h4>{k.ad}</h4>
                <p>{k.aciklama || "Açıklama yakında"}</p>
                <button className="konu-btn">📘 Bu Konudan Başla</button>
              </div>
            ))}
          </div>
        )}

        {aktifTab === "videolar" && (
          <div className="video-grid">
            {videolar.map((v) => (
              <div key={v.id} className="video-card">
                <iframe
                  src={v.url}
                  title={v.baslik}
                  allowFullScreen
                ></iframe>
                <p>{v.baslik}</p>
              </div>
            ))}
          </div>
        )}

        {aktifTab === "istatistikler" && (
          <div className="istatistikler">
            <h4>İstatistikler - {ders.ad}</h4>
            <ul>
              <li>📘 Toplam Konu: {konular.length}</li>
              <li>🎯 Doğruluk Oranı: %87</li>
              <li>🕒 Ortalama Süre: 12dk</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
