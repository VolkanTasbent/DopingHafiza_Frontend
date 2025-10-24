// src/Raporlarim.jsx
import React, { useEffect, useState } from "react";
import api from "./services/api";
import "./AuthPage.css";

export default function Raporlarim({ onBack }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [detayModal, setDetayModal] = useState(false);
  const [detayVeri, setDetayVeri] = useState([]);
  const [detayLoading, setDetayLoading] = useState(false);

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
        const { data } = await api.get("/api/raporlar", { params: { limit: 20 } });
        setList(Array.isArray(data) ? data : []);
      } catch (e) {
        setMsg("Oturumlar alınamadı: " + errText(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openDetay = async (oturumId) => {
    try {
      setDetayLoading(true);
      setMsg("");
      const { data } = await api.get(`/api/raporlar/${oturumId}/detay`, {
        params: { sadeceYanlis: true },
      });
      setDetayVeri(data?.items || []);
      setDetayModal(true);
    } catch (e) {
      setMsg("Detay alınamadı: " + errText(e));
    } finally {
      setDetayLoading(false);
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

          {list.map((row) => (
            <div
              key={row.oturumId}
              className="rapor-card"
            >
              <div className="rapor-header">
                <span><b>Tarih:</b> {fmt(row.finishedAt)}</span>
                <span><b>Skor:</b> {row.score ?? 0}</span>
              </div>
              <div className="rapor-stats">
                ✅ {row.correctCount ?? 0} | ❌ {row.wrongCount ?? 0} | 🧩 {row.totalCount ?? 0}
                <span className="süre">⏱ {fmtMs(row.durationMs)}</span>
              </div>
              <button
                onClick={() => openDetay(row.oturumId)}
                className="detay-btn"
              >
                Detay
              </button>
            </div>
          ))}

          {/* === Popup Modal === */}
          {detayModal && (
            <div className="popup-arka">
              <div className="popup-icerik">
                <h3 className="popup-baslik">🧠 Yanlış Yapılan Sorular</h3>

                {detayLoading ? (
                  <p>Detaylar yükleniyor...</p>
                ) : detayVeri.length === 0 ? (
                  <p className="text-center">Tüm cevaplar doğru 🎉</p>
                ) : (
                  <div className="detay-tablo">
                    <table>
                      <thead>
                        <tr>
                          <th>Ders</th>
                          <th>Konu</th>
                          <th>Soru</th>
                          <th>Seçilen Şık</th>
                          <th>Doğru Şık</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detayVeri.map((it, i) => {
                          const s = it.soru;
                          return (
                            <tr key={it.id || i}>
                              <td>{s?.dersAd || "-"}</td>
                              <td>
                                {Array.isArray(s?.konular) && s.konular.length
                                  ? s.konular.map((k) => k.ad).join(", ")
                                  : "-"}
                              </td>
                              <td>{s?.metin || "-"}</td>
                              <td className="yanlis">
                                {(() => {
                                  const chosenId = it.secenekId;
                                  const found = (s?.secenekler || []).find(
                                    (x) => x.id === chosenId
                                  );
                                  return found?.metin || "-";
                                })()}
                              </td>
                              <td className="dogru">
                                {(() => {
                                  const correct = (s?.secenekler || []).find(
                                    (x) => x.dogru === true
                                  );
                                  return correct?.metin || "-";
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="popup-alt">
                  <button
                    onClick={() => setDetayModal(false)}
                    className="kapat-btn"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
