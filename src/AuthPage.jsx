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
  // Alan bazlı hata mesajları
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Giriş yapıldığında streak'i güncelle
  const updateStreakOnLogin = () => {
    try {
      const today = new Date().toLocaleDateString("tr-TR");
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("tr-TR");
      const saved = localStorage.getItem("streakData");
      
      let newStreak = 1;
      
      if (saved) {
        const data = JSON.parse(saved);
        
        if (data.last === today) {
          // Bugün zaten giriş yapılmış, streak değişmez
          newStreak = data.streak || 0;
        } else if (data.last === yesterday) {
          // Dün giriş yapılmış, streak artar
          newStreak = (data.streak || 0) + 1;
        } else {
          // Streak bozulmuş, sıfırdan başla
          newStreak = 1;
        }
      }
      
      // Streak'i kaydet
      localStorage.setItem("streakData", JSON.stringify({ 
        streak: newStreak, 
        last: today 
      }));
      
      // Backend'e bildir (opsiyonel - backend kendi hesaplıyorsa gerekmez)
      try {
        api.post("/api/users/update-streak-on-login").catch(() => {
          // Backend endpoint yoksa sessizce geç
        });
      } catch (e) {
        // Hata durumunda sessizce geç
      }
    } catch (e) {
      console.error("Streak güncelleme hatası:", e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setEmailError("");
    setPasswordError("");
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
        
        const { data } = await api.post("/api/auth/register", registerData);
        
        // Kayıt sonrası hedef bilgilerini backend'e kaydet
        if (data.user?.id && (hedefUniversite || hedefBolum)) {
          try {
            await api.put("/api/users/me", {
              hedefUniversite: hedefUniversite,
              hedefBolum: hedefBolum,
              hedefSiralama: hedefSiralama
            });
          } catch (error) {
            console.error("Hedef bilgileri kaydedilemedi:", error);
            // Fallback: localStorage'a kaydet
            localStorage.setItem(`userHedef_${data.user.id}`, JSON.stringify({
              universite: hedefUniversite,
              bolum: hedefBolum,
              siralamaHedef: hedefSiralama
            }));
          }
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
        setHedefSiralama(10000);
      } else {
        try {
          const response = await api.post("/api/auth/login", { email, password: sifre });
          const data = response?.data || response;
          
          if (data?.token && data?.user) {
        localStorage.setItem("token", data.token);
            
            // Giriş yapıldığında streak'i güncelle (sadece giriş yapmak yeterli)
            updateStreakOnLogin();
            
        onSuccess?.(data.user);
          } else {
            throw new Error("Giriş başarılı ancak beklenen veri formatı alınamadı.");
          }
        } catch (loginError) {
          // Login hatasını yukarıdaki catch bloğuna fırlat
          throw loginError;
        }
      }
    } catch (err) {
      console.error("🔴 Auth error:", err);
      console.error("🔴 Error response:", err?.response);
      console.error("🔴 Error response data:", err?.response?.data);
      console.error("🔴 Error response status:", err?.response?.status);
      
      // Hata verisini güvenli bir şekilde al
      let errorData = null;
      let errorMessage = "Giriş/Kayıt işlemi başarısız.";
      
      try {
        // Axios hataları için
        if (err?.response?.data) {
          errorData = err.response.data;
          console.log("📦 Raw error data:", errorData, "Type:", typeof errorData);
          
          // Eğer string ise JSON parse etmeyi dene
          if (typeof errorData === 'string') {
            try {
              errorData = JSON.parse(errorData);
              console.log("✅ Parsed error data:", errorData);
            } catch (e) {
              // String olarak kal
              console.log("⚠️ Could not parse as JSON, using as string");
              errorMessage = errorData;
              errorData = { message: errorData };
            }
          }
          
          // Spring Boot exception formatını handle et
          // Backend'den gelen format: { error: "...", status: 500, type: "BadCredentialsException" }
          if (errorData && typeof errorData === 'object') {
            // Spring Boot formatından bizim formata çevir
            if (errorData.type === "BadCredentialsException" || errorData.error === "Bad credentials") {
              // BadCredentialsException genellikle şifre yanlış demektir
              // Ancak kullanıcı bulunamadıysa da olabilir
              // Backend'in daha detaylı mesaj göndermesi gerekiyor
              // Şimdilik şifre alanında hata gösterelim (en yaygın durum)
              errorData.errorType = "INVALID_PASSWORD";
              errorData.field = "password";
              errorData.message = errorData.message || "Şifre yanlış.";
            } else if (errorData.type === "UsernameNotFoundException") {
              errorData.errorType = "INVALID_EMAIL";
              errorData.field = "email";
              errorData.message = errorData.message || errorData.error || "Bu e-posta adresi bulunamadı.";
            } else if (errorData.type && !errorData.errorType) {
              // Diğer exception tipleri için genel hata
              errorData.errorType = "INVALID_CREDENTIALS";
              errorData.message = errorData.message || errorData.error || "Giriş başarısız.";
            }
            
            // error field'ını message'a çevir (eğer message yoksa)
            if (!errorData.message && errorData.error) {
              errorData.message = errorData.error;
            }
          }
          
          // Error message'ı string olarak al (object değil!)
          if (errorData && typeof errorData === 'object') {
            errorMessage = errorData.message || errorData.error || "Giriş/Kayıt işlemi başarısız.";
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          }
          
          console.log("📝 Final error message:", errorMessage);
          console.log("📝 Final error data:", errorData);
        } else if (err?.message) {
          errorMessage = err.message;
          console.log("📝 Using error.message:", errorMessage);
        }
      } catch (parseError) {
        console.error("❌ Error parsing response:", parseError);
        errorMessage = "Bir hata oluştu. Lütfen tekrar deneyin.";
      }
      
      // Backend'den gelen hata tipine göre alan bazlı mesajlar
      if (errorData && typeof errorData === 'object') {
        if (errorData.errorType) {
          switch (errorData.errorType) {
            case "INVALID_EMAIL":
            case "USER_NOT_FOUND":
              setEmailError(errorData.message || "Bu e-posta adresi bulunamadı.");
              break;
            case "INVALID_PASSWORD":
            case "WRONG_PASSWORD":
              setPasswordError(errorData.message || "Şifre yanlış.");
              break;
            case "ACCOUNT_DISABLED":
              setEmailError(errorData.message || "Bu hesap devre dışı bırakılmış.");
              break;
            case "INVALID_CREDENTIALS":
              // Eğer backend hangi alanın yanlış olduğunu belirtmiyorsa
              if (errorData.field === "email") {
                setEmailError(errorData.message || "E-posta adresi bulunamadı.");
              } else if (errorData.field === "password") {
                setPasswordError(errorData.message || "Şifre yanlış.");
              } else {
                // Her iki alan için de genel mesaj
                setEmailError("E-posta veya şifre hatalı.");
                setPasswordError("E-posta veya şifre hatalı.");
              }
              break;
            default:
              // msg her zaman string olmalı!
              setMsg(typeof errorMessage === 'string' ? errorMessage : "Giriş/Kayıt işlemi başarısız.");
          }
        } else if (errorData.field) {
          // Backend field bazlı hata gönderiyorsa
          if (errorData.field === "email") {
            setEmailError(errorData.message || "E-posta adresi geçersiz.");
          } else if (errorData.field === "password") {
            setPasswordError(errorData.message || "Şifre geçersiz.");
          } else {
            // msg her zaman string olmalı!
            setMsg(typeof errorMessage === 'string' ? errorMessage : "Giriş/Kayıt işlemi başarısız.");
          }
        } else {
          // Genel hata mesajı - msg her zaman string olmalı!
          setMsg(typeof errorMessage === 'string' ? errorMessage : "Giriş/Kayıt işlemi başarısız.");
        }
      } else {
        // Hata verisi yoksa genel mesaj göster - msg her zaman string olmalı!
        setMsg(typeof errorMessage === 'string' ? errorMessage : "Giriş/Kayıt işlemi başarısız.");
      }
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
              <p className="auth-subtitle">
                {isRegister 
                  ? "Doping Hafıza'ya katıl ve hedeflerine ulaş!" 
                  : "Doping Hafıza'ya tekrar hoş geldin"}
              </p>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={`tab-btn ${!isRegister ? "active" : ""}`}
                onClick={() => {
                  setIsRegister(false);
                  setMsg("");
                  setEmailError("");
                  setPasswordError("");
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
                  setEmailError("");
                  setPasswordError("");
                }}
              >
                Kayıt Ol
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {msg && typeof msg === 'string' && (
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
                  className={`form-input ${emailError ? "input-error" : ""}`}
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(""); // Kullanıcı yazmaya başladığında hatayı temizle
                  }}
                  required
                  disabled={loading}
                />
                {emailError && (
                  <div className="field-error">
                    <span className="error-icon">⚠</span>
                    <span>{emailError}</span>
                  </div>
                )}
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
                  className={`form-input ${passwordError ? "input-error" : ""}`}
                  placeholder="••••••••"
                  value={sifre}
                  onChange={(e) => {
                    setSifre(e.target.value);
                    setPasswordError(""); // Kullanıcı yazmaya başladığında hatayı temizle
                  }}
                  required
                  disabled={loading}
                />
                {passwordError && (
                  <div className="field-error">
                    <span className="error-icon">⚠</span>
                    <span>{passwordError}</span>
                  </div>
                )}
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
                    setEmailError("");
                    setPasswordError("");
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
