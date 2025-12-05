import { useState } from "react";
import api from "./services/api";
import "./AuthPage.css";

export default function AuthPage({ onSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [sifre, setSifre] = useState("");
  const [sinif, setSinif] = useState("");
  const [hedefUniversite, setHedefUniversite] = useState("");
  const [hedefBolum, setHedefBolum] = useState("");
  const [hedefSiralama, setHedefSiralama] = useState(10000);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      if (isRegister) {
        const registerData = {
          email,
          ad,
          soyad,
          password: sifre,
          sinif: sinif || null,
        };
        
        await api.post("/api/auth/register", registerData);
        
        // Hedef bilgilerini localStorage'a kaydet
        if (hedefUniversite || hedefBolum) {
          localStorage.setItem("userHedef", JSON.stringify({
            universite: hedefUniversite,
            bolum: hedefBolum,
            siralamaHedef: hedefSiralama
          }));
        }
        
        setMsg("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
        setIsRegister(false);
        setEmail("");
        setAd("");
        setSoyad("");
        setSifre("");
        setSinif("");
        setHedefUniversite("");
        setHedefBolum("");
        setHedefNet(85);
      } else {
        const { data } = await api.post("/api/auth/login", { email, password: sifre });
        localStorage.setItem("token", data.token);
        onSuccess?.(data.user);
      }
    } catch (err) {
      setMsg(err?.response?.data?.message || err?.response?.data || "Giriş/Kayıt işlemi başarısız.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">
        {/* Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-form-container">
            <div className="auth-header">
              <h2 className="auth-title">
                {isRegister ? "Hesap Oluştur" : "Hoş Geldiniz"}
              </h2>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={`tab-btn ${!isRegister ? "active" : ""}`}
                onClick={() => {
                  setIsRegister(false);
                  setMsg("");
                }}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                className={`tab-btn ${isRegister ? "active" : ""}`}
                onClick={() => {
                  setIsRegister(true);
                  setMsg("");
                }}
              >
                Kayıt Ol
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {msg && (
                <div className={`auth-message ${msg.includes("başarılı") ? "success" : "error"}`}>
                  <span className="message-icon">
                    {msg.includes("başarılı") ? "✓" : "⚠"}
                  </span>
                  <span>{msg}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">E-posta Adresi</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {isRegister && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Ad</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Adınız"
                        value={ad}
                        onChange={(e) => setAd(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Soyad</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Soyadınız"
                        value={soyad}
                        onChange={(e) => setSoyad(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Sınıf</label>
                    <select
                      className="form-input"
                      value={sinif}
                      onChange={(e) => setSinif(e.target.value)}
                      required
                      disabled={loading}
                    >
                      <option value="">Sınıf Seçiniz</option>
                      <option value="9">9. Sınıf</option>
                      <option value="10">10. Sınıf</option>
                      <option value="11">11. Sınıf</option>
                      <option value="12">12. Sınıf</option>
                    </select>
                  </div>

                  <div className="form-section-divider">
                    <span>🎯 Hedef Bilgileri</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hedef Üniversite</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Örn: Marmara Üniversitesi"
                      value={hedefUniversite}
                      onChange={(e) => setHedefUniversite(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hedef Bölüm</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Örn: Bilgisayar Mühendisliği"
                      value={hedefBolum}
                      onChange={(e) => setHedefBolum(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hedef Sıralama</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="10000"
                      min="1"
                      max="1000000"
                      value={hedefSiralama}
                      onChange={(e) => setHedefSiralama(parseInt(e.target.value) || 10000)}
                      disabled={loading}
                    />
                    <small className="form-hint">TYT/AYT için hedeflediğiniz sıralama (örn: 10000)</small>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Şifre</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <button 
                type="submit" 
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading">
                    <span className="spinner"></span>
                    {isRegister ? "Kaydediliyor..." : "Giriş yapılıyor..."}
                  </span>
                ) : (
                  <span>
                    {isRegister ? "Kayıt Ol" : "Giriş Yap"}
                  </span>
                )}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                {isRegister
                  ? "Zaten hesabınız var mı?"
                  : "Hesabınız yok mu?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setMsg("");
                    // Form alanlarını temizle
                    if (!isRegister) {
                      setSinif("");
                      setHedefUniversite("");
                      setHedefBolum("");
                      setHedefSiralama(10000);
                    }
                  }}
                  className="auth-link-btn"
                >
                  {isRegister ? "Giriş Yap" : "Kayıt Ol"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
