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
        setMsg("✅ Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
        setIsRegister(false);
      } else {
        const { data } = await api.post("/api/auth/login", { email, password: sifre });
        localStorage.setItem("token", data.token);
        onSuccess?.(data.user);
      }
    } catch (err) {
      setMsg(err?.response?.data || "❌ Giriş/Kayıt işlemi başarısız.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <h2 className="auth-title">
            {isRegister ? "👤 Yeni Hesap Oluştur" : "🔑 Giriş Yap"}
          </h2>
          <div className="tab-buttons">
            <button
              type="button"
              className={isRegister ? "" : "active"}
              onClick={() => setIsRegister(false)}
            >
              Giriş
            </button>
            <button
              type="button"
              className={isRegister ? "active" : ""}
              onClick={() => setIsRegister(true)}
            >
              Kayıt Ol
            </button>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {msg && (
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                padding: "8px 12px",
                borderRadius: "8px",
                marginBottom: "12px",
                color: msg.startsWith("✅") ? "#22c55e" : "#ef4444",
                fontWeight: 500,
              }}
            >
              {msg}
            </div>
          )}

          <label>E-posta</label>
          <input
            type="email"
            placeholder="ornek@eposta.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {isRegister && (
            <>
              <label>Ad</label>
              <input
                placeholder="Adınızı girin"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                required
              />

              <label>Soyad</label>
              <input
                placeholder="Soyadınızı girin"
                value={soyad}
                onChange={(e) => setSoyad(e.target.value)}
                required
              />
            </>
          )}

          <label>Şifre</label>
          <input
            type="password"
            placeholder="••••••••"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? isRegister
                ? "Kaydediliyor..."
                : "Giriş yapılıyor..."
              : isRegister
              ? "Kayıt Ol"
              : "Giriş Yap"}
          </button>
        </form>

        <div style={{ marginTop: "1rem", textAlign: "center", fontSize: ".9rem", color: "#9aa4b2" }}>
          {isRegister
            ? "Zaten hesabınız var mı?"
            : "Hesabınız yok mu?"}{" "}
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="btn-ghost"
            style={{ padding: "6px 12px", fontSize: ".9rem" }}
          >
            {isRegister ? "Giriş Yap" : "Kayıt Ol"}
          </button>
        </div>
      </div>
    </div>
  );
}
