// src/SearchModal.jsx
import React, { useEffect, useState } from "react";
import api from "./services/api";
import "./SearchModal.css";

export default function SearchModal({ isOpen, onClose, onNavigate, onSelectDers, onSelectDersDetay }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState({
    dersler: [],
    konular: [],
    sorular: []
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // all, dersler, konular, sorular
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && searchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        performSearch(searchQuery);
      }, 300); // Debounce

      return () => clearTimeout(timeoutId);
    } else {
      setResults({ dersler: [], konular: [], sorular: [] });
    }
  }, [searchQuery, isOpen]);

  // ESC tuşu ile kapatma
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, onClose]);

  const performSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setResults({ dersler: [], konular: [], sorular: [] });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const searchLower = query.toLowerCase().trim();
      console.log("🔍 Arama başlatıldı:", searchLower);

      // Ders arama
      let dersler = [];
      try {
        const dersResponse = await api.get("/api/ders");
        console.log("📘 Dersler API yanıtı:", dersResponse.data);
        const allDersler = Array.isArray(dersResponse.data) ? dersResponse.data : [];
        dersler = allDersler.filter(ders => {
          if (!ders || !ders.ad) return false;
          const dersAd = (ders.ad || "").toLowerCase();
          return dersAd.includes(searchLower);
        });
        console.log("📘 Filtrelenmiş dersler:", dersler.length, dersler);
      } catch (e) {
        console.error("Ders arama hatası:", e);
        if (!error) setError("Dersler yüklenirken bir hata oluştu");
      }

      // Konu arama - tüm derslerden konuları çek
      const konular = [];
      try {
        const dersResponse = await api.get("/api/ders");
        const allDersler = dersResponse.data || [];
        console.log("📚 Toplam ders sayısı:", allDersler.length);

        // Paralel olarak tüm konuları çek
        const konuPromises = allDersler.map(async (ders) => {
          try {
            const konuResponse = await api.get("/api/konu", {
              params: { dersId: ders.id }
            });
            const filteredKonular = (konuResponse.data || []).filter(konu => {
              const konuAd = (konu.ad || "").toLowerCase();
              return konuAd.includes(searchLower);
            });
            return filteredKonular.map(konu => ({
              ...konu,
              dersAd: ders.ad,
              dersId: ders.id
            }));
          } catch (e) {
            console.warn(`Ders ${ders.id} için konu bulunamadı:`, e);
            return [];
          }
        });

        const konuResults = await Promise.all(konuPromises);
        konular.push(...konuResults.flat());
        console.log("📚 Filtrelenmiş konular:", konular);
      } catch (e) {
        console.error("Konu arama hatası:", e);
        if (!error) setError("Konular yüklenirken bir hata oluştu");
      }

      // Soru arama - Backend 500 hatası veriyorsa atla
      // excludeDenemeSinavi parametresi backend'de sorun çıkarıyor, bu yüzden kaldırıyoruz
      let sorular = [];
      try {
        // excludeDenemeSinavi parametresi olmadan dene (backend 500 hatası veriyor)
        let soruResponse;
        try {
          // Önce search parametresi ile dene (eğer backend destekliyorsa)
          soruResponse = await api.get("/api/sorular", {
            params: { 
              search: searchTerm,
              limit: 50
              // excludeDenemeSinavi kaldırıldı - backend 500 hatası veriyor
            }
          });
          console.log("❓ Sorular API yanıtı (search ile):", soruResponse.data?.length || 0, "soru");
        } catch (searchError) {
          // Search parametresi desteklenmiyorsa, sadece limit ile dene
          console.log("Search parametresi desteklenmiyor, limit ile tekrar deneniyor...");
          try {
            soruResponse = await api.get("/api/sorular", {
              params: { 
                limit: 50
                // excludeDenemeSinavi kaldırıldı - backend 500 hatası veriyor
              }
            });
            console.log("❓ Sorular API yanıtı (limit 50):", soruResponse.data?.length || 0, "soru");
          } catch (limitError) {
            // Hala hata veriyorsa, soru aramayı atla
            console.warn("Soru arama endpoint'i çalışmıyor, atlanıyor:", limitError.response?.status || limitError.message);
            throw limitError; // Dış catch bloğuna yönlendir
          }
        }
        
        if (soruResponse && soruResponse.data && Array.isArray(soruResponse.data)) {
          sorular = soruResponse.data.filter(soru => {
            // Ekstra güvenlik için deneme sınavı sorularını tekrar filtrele
            const denemeAdi = soru.denemeAdi || soru.deneme_adi || soru.denemeAd || soru.deneme_ad;
            if (denemeAdi) return false;
            if (soru.denemeSinaviId || soru.deneme_sinavi_id) return false;
            if (soru.denemeSinavi || soru.deneme_sinavi) return false;
            if (soru.aciklama && typeof soru.aciklama === 'string' && soru.aciklama.includes('[Deneme')) return false;

            // Arama terimine göre filtrele (eğer backend'de search yapılmadıysa)
            const metin = (soru.metin || "").toLowerCase();
            const aciklama = (soru.aciklama || "").toLowerCase();
            const dersAd = (soru.dersAd || "").toLowerCase();
            
            return metin.includes(searchLower) ||
                   aciklama.includes(searchLower) ||
                   dersAd.includes(searchLower);
          }).map(soru => {
            // Ders bilgisini ekle
            return {
              ...soru,
              dersId: soru.dersId || soru.ders?.id || soru.ders_id || null,
              dersAd: soru.dersAd || soru.ders?.ad || soru.ders_ad || "Genel"
            };
          }).slice(0, 20); // İlk 20 sonuç
        }
        
        console.log("❓ Filtrelenmiş sorular:", sorular.length);
      } catch (e) {
        console.error("Soru arama hatası:", e);
        // 500 hatası veya diğer hatalar için sessizce devam et
        // Kullanıcıya sadece ders ve konu sonuçları gösterilecek
        sorular = [];
        // Sadece kritik olmayan hataları logla
        if (e.response?.status && e.response.status !== 500 && e.response.status !== 404 && e.response.status !== 401) {
          const errorMsg = e.response?.data?.message || e.message || "Bilinmeyen hata";
          console.warn("Soru arama uyarısı:", errorMsg);
        }
      }

      console.log("✅ Arama sonuçları:", { dersler: dersler.length, konular: konular.length, sorular: sorular.length });
      setResults({ dersler, konular, sorular });
    } catch (error) {
      console.error("❌ Arama hatası:", error);
      setResults({ dersler: [], konular: [], sorular: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleDersClick = (ders) => {
    if (onSelectDersDetay && onNavigate) {
      // Ders detay sayfasına git
      onSelectDersDetay(ders);
      onNavigate("dersdetay");
    } else if (onNavigate) {
      // Fallback: Dersler sayfasına git
      onNavigate("dersler");
    }
    onClose();
  };

  const handleKonuClick = (konu) => {
    if (onSelectDersDetay && onNavigate && konu.dersId) {
      // Konunun dersine git
      onSelectDersDetay({ id: konu.dersId, ad: konu.dersAd || "Ders" });
      onNavigate("dersdetay");
    } else if (onNavigate) {
      // Fallback: Dersler sayfasına git
      onNavigate("dersler");
    }
    onClose();
  };

  const handleSoruClick = (soru) => {
    // Soru çözme sayfasına git - ders bilgisi gerekli
    if (onNavigate) {
      // Soru için ders bilgisi varsa onu kullan
      if (soru.dersId && onSelectDers) {
        // Ders bilgisi ile soru çözme sayfasına git
        onSelectDers({ id: soru.dersId, ad: soru.dersAd || "Genel" });
        onNavigate("coz");
      } else if (soru.dersId) {
        // onSelectDers yoksa sadece sayfaya git
        onNavigate("coz");
      } else {
        // Ders bilgisi yoksa dersler sayfasına yönlendir
        onNavigate("dersler");
      }
    }
    onClose();
  };

  const totalResults = results.dersler.length + results.konular.length + results.sorular.length;

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-modal-input"
              placeholder="Ders, konu veya soru ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>
          <button className="search-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="search-tabs">
          <button
            className={`search-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            Tümü ({totalResults})
          </button>
          <button
            className={`search-tab ${activeTab === "dersler" ? "active" : ""}`}
            onClick={() => setActiveTab("dersler")}
          >
            Dersler ({results.dersler.length})
          </button>
          <button
            className={`search-tab ${activeTab === "konular" ? "active" : ""}`}
            onClick={() => setActiveTab("konular")}
          >
            Konular ({results.konular.length})
          </button>
          <button
            className={`search-tab ${activeTab === "sorular" ? "active" : ""}`}
            onClick={() => setActiveTab("sorular")}
          >
            Sorular ({results.sorular.length})
          </button>
        </div>

        <div className="search-results">
          {error && (
            <div className="search-error">
              <span className="search-error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          )}
          {loading ? (
            <div className="search-loading">
              <div className="search-spinner"></div>
              <p>Aranıyor...</p>
            </div>
          ) : searchQuery.trim().length < 2 ? (
            <div className="search-empty">
              <span className="search-empty-icon">🔍</span>
              <p>Aramak için en az 2 karakter girin</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="search-empty">
              <span className="search-empty-icon">😕</span>
              <p>Sonuç bulunamadı</p>
              <span className="search-empty-hint">Farklı bir arama terimi deneyin</span>
            </div>
          ) : (
            <>
              {(activeTab === "all" || activeTab === "dersler") && results.dersler.length > 0 && (
                <div className="search-section">
                  <div className="search-section-header">
                    <span className="search-section-icon">📘</span>
                    <h3>Dersler ({results.dersler.length})</h3>
                  </div>
                  <div className="search-items">
                    {results.dersler.map((ders) => (
                      <div
                        key={ders.id}
                        className="search-item"
                        onClick={() => handleDersClick(ders)}
                      >
                        <div className="search-item-icon">📘</div>
                        <div className="search-item-content">
                          <div className="search-item-title">{ders.ad}</div>
                          <div className="search-item-subtitle">Ders</div>
                        </div>
                        <div className="search-item-arrow">→</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab === "all" || activeTab === "konular") && results.konular.length > 0 && (
                <div className="search-section">
                  <div className="search-section-header">
                    <span className="search-section-icon">📚</span>
                    <h3>Konular ({results.konular.length})</h3>
                  </div>
                  <div className="search-items">
                    {results.konular.map((konu) => (
                      <div
                        key={konu.id}
                        className="search-item"
                        onClick={() => handleKonuClick(konu)}
                      >
                        <div className="search-item-icon">📚</div>
                        <div className="search-item-content">
                          <div className="search-item-title">{konu.ad}</div>
                          <div className="search-item-subtitle">{konu.dersAd}</div>
                        </div>
                        <div className="search-item-arrow">→</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab === "all" || activeTab === "sorular") && results.sorular.length > 0 && (
                <div className="search-section">
                  <div className="search-section-header">
                    <span className="search-section-icon">❓</span>
                    <h3>Sorular ({results.sorular.length})</h3>
                  </div>
                  <div className="search-items">
                    {results.sorular.map((soru) => (
                      <div
                        key={soru.id}
                        className="search-item search-item-question"
                        onClick={() => handleSoruClick(soru)}
                      >
                        <div className="search-item-icon">❓</div>
                        <div className="search-item-content">
                          <div className="search-item-title">
                            {soru.metin?.substring(0, 100)}
                            {soru.metin?.length > 100 ? "..." : ""}
                          </div>
                          <div className="search-item-subtitle">
                            {soru.dersAd || "Genel"} • {soru.zorluk ? `Zorluk: ${soru.zorluk}` : ""}
                          </div>
                        </div>
                        <div className="search-item-arrow">→</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="search-footer">
          <div className="search-shortcuts">
            <span className="shortcut-hint">💡 Kısayollar:</span>
            <kbd>Esc</kbd> Kapat
          </div>
        </div>
      </div>
    </div>
  );
}

