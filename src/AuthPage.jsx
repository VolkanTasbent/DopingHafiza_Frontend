import { useState } from "react";
import api from "./services/api";
import "./AuthPage.css";

export default function AuthPage({ onSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [sifre, setSifre] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      if (isRegister) {
        await api.post("/api/auth/register", { email, ad, soyad, password: sifre });
        setMsg("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
        setIsRegister(false);
        setEmail("");
        setAd("");
        setSoyad("");
        setSifre("");
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
