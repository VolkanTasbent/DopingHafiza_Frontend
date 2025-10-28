// src/DersDetay.jsx
import { useEffect, useState } from "react";
import api, { fileUrl } from "./services/api";
import "./DersDetay.css";

export default function DersDetay({ ders, onBack }) {
  const [konular, setKonular] = useState([]);
  const [videolar, setVideolar] = useState([]);
  const [aktifTab, setAktifTab] = useState("konular");
  const [loading, setLoading] = useState(true);
  
  // PDF Modal state
  const [pdfModal, setPdfModal] = useState({
    isOpen: false,
    url: null,
    adi: null
  });

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

  const openPdfModal = (konu) => {
    setPdfModal({
      isOpen: true,
      url: konu.dokumanUrl || konu.dokuman_url,
      adi: konu.dokumanAdi || konu.dokuman_adi || konu.ad
    });
  };

  const closePdfModal = () => {
    setPdfModal({
      isOpen: false,
      url: null,
      adi: null
    });
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
                <div className="konu-card-header">
                  <h4>{k.ad}</h4>
                  {(k.dokumanUrl || k.dokuman_url) && (
                    <span className="dokuman-badge">📄 PDF Var</span>
                  )}
                </div>
                <p>{k.aciklama || "Açıklama yakında"}</p>
                <div className="konu-actions">
                  <button className="konu-btn primary">📘 Bu Konudan Başla</button>
                  {(k.dokumanUrl || k.dokuman_url) && (
                    <button 
                      className="konu-btn secondary"
                      onClick={() => openPdfModal(k)}
                    >
                      📄 Döküman Görüntüle
                    </button>
                  )}
                </div>
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

      {/* PDF Modal */}
      {pdfModal.isOpen && (
        <div className="pdf-modal-overlay" onClick={closePdfModal}>
          <div className="pdf-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-modal-header">
              <h3>📄 {pdfModal.adi}</h3>
              <button className="pdf-modal-close" onClick={closePdfModal}>
                ✕
              </button>
            </div>
            <div className="pdf-modal-body">
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '24px',
                padding: '40px'
              }}>
                <div style={{ fontSize: '5rem' }}>📄</div>
                <h3 style={{ fontSize: '1.5rem', color: '#111827', margin: 0 }}>
                  {pdfModal.adi}
                </h3>
                <p style={{ color: '#6b7280', textAlign: 'center', maxWidth: '500px' }}>
                  PDF dökümanı görüntülemek için aşağıdaki butona tıklayın.
                  Döküman yeni sekmede açılacaktır.
                </p>
                <a 
                  href={fileUrl(pdfModal.url)} 
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '16px 48px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '12px',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    boxShadow: '0 8px 20px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.3s',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(102, 126, 234, 0.5)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
                  }}
                >
                  🔍 PDF'i Görüntüle
                </a>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                  Dosya boyutu değişiklik gösterebilir
                </p>
              </div>
            </div>
            <div className="pdf-modal-footer">
              <a 
                href={fileUrl(pdfModal.url)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="pdf-download-btn"
              >
                ⬇️ PDF'i İndir
              </a>
              <button onClick={closePdfModal} className="pdf-close-btn">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
