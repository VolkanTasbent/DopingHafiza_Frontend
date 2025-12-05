// src/Profilim.jsx
import React, { useEffect, useState, useRef } from "react";
import api, { fileUrl } from "./services/api";
import "./Profilim.css";

export default function Profilim({ onBack }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [hedefForm, setHedefForm] = useState({
    universite: "",
    bolum: "",
    siralamaHedef: 10000
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/api/users/me");
        setUser(data);
        setEditForm({
          ad: data.ad || "",
          soyad: data.soyad || "",
          email: data.email || "",
        });
        
        // Hedef bilgilerini backend'den yükle
        setHedefForm({
          universite: data.hedefUniversite || data.hedef_universite || "",
          bolum: data.hedefBolum || data.hedef_bolum || "",
          siralamaHedef: data.hedefSiralama || data.hedef_siralama || data.siralamaHedef || 10000
        });
        
        // Fallback: Eğer backend'de yoksa localStorage'dan yükle
        if (!data.hedefUniversite && !data.hedef_universite) {
          const savedHedef = localStorage.getItem(`userHedef_${data.id}`);
          if (savedHedef) {
            try {
              const parsed = JSON.parse(savedHedef);
              setHedefForm({
                universite: parsed.universite || "",
                bolum: parsed.bolum || "",
                siralamaHedef: parsed.siralamaHedef || 10000
              });
            } catch (e) {
              console.error("Hedef bilgileri parse edilemedi:", e);
            }
          }
        }
      } catch (e) {
        setMsg("Profil alınamadı: " + (e.response?.data || e.message));
      } finally {
        setLoading(false);
      }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setMsg("Lütfen bir resim dosyası seçin.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMsg("Resim boyutu 5MB'dan küçük olmalıdır.");
      return;
    }

    try {
      setUploading(true);
      setMsg("");

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);

      // Upload to backend - returns updated user object
      const { data: updatedUser } = await api.post("/api/files/upload-avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Update state with the returned user data (avatar_url already updated!)
      setUser(updatedUser);
      setEditForm({
        ad: updatedUser.ad || "",
        soyad: updatedUser.soyad || "",
        email: updatedUser.email || "",
      });

      setMsg("Profil resmi başarıyla güncellendi!");
      setTimeout(() => setMsg(""), 3000);
    } catch (error) {
      console.error("Upload error:", error);
      const errorMsg = error.response?.data?.message || error.response?.data || error.message;
      setMsg("Resim yüklenirken hata oluştu: " + errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      setMsg("");
      
      // Profil ve hedef bilgilerini backend'e kaydet
      await api.put("/api/users/me", {
        ...user,
        ...editForm,
        hedefUniversite: hedefForm.universite,
        hedefBolum: hedefForm.bolum,
        hedefSiralama: hedefForm.siralamaHedef
      });

      // Fallback: LocalStorage'a da kaydet
      if (user?.id) {
        localStorage.setItem(`userHedef_${user.id}`, JSON.stringify(hedefForm));
      }

      await fetchUserData();
      setIsEditing(false);
      setMsg("Profil ve hedef bilgileri başarıyla güncellendi!");
      setTimeout(() => setMsg(""), 3000);
    } catch (error) {
      setMsg("Profil güncellenirken hata oluştu: " + (error.response?.data || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      ad: user.ad || "",
      soyad: user.soyad || "",
      email: user.email || "",
    });
    
    // Hedef formunu backend'den gelen verilerle sıfırla
    if (user) {
      setHedefForm({
        universite: user.hedefUniversite || user.hedef_universite || "",
        bolum: user.hedefBolum || user.hedef_bolum || "",
        siralamaHedef: user.hedefSiralama || user.hedef_siralama || user.siralamaHedef || 10000
      });
      
      // Fallback: localStorage'dan yükle
      if (!user.hedefUniversite && !user.hedef_universite && user.id) {
        const savedHedef = localStorage.getItem(`userHedef_${user.id}`);
        if (savedHedef) {
          try {
            const parsed = JSON.parse(savedHedef);
            setHedefForm({
              universite: parsed.universite || "",
              bolum: parsed.bolum || "",
              siralamaHedef: parsed.siralamaHedef || 10000
            });
          } catch (e) {
            setHedefForm({ universite: "", bolum: "", siralamaHedef: 10000 });
          }
        } else {
          setHedefForm({ universite: "", bolum: "", siralamaHedef: 10000 });
        }
      }
    } else {
      setHedefForm({ universite: "", bolum: "", siralamaHedef: 10000 });
    }
    
    setMsg("");
  };

  if (loading && !user) return (
    <div className="profil-container">
      <div className="profil-loading">
        <div className="spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="profil-container">
      <p className="error-msg">Kullanıcı bilgisi bulunamadı.</p>
    </div>
  );

  const getInitials = () => {
    const ad = user.ad || "";
    const soyad = user.soyad || "";
    return `${ad.charAt(0)}${soyad.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="profil-container">
      <div className="profil-card">
        {/* Header */}
        <div className="profil-header">
          <button className="back-button" onClick={onBack}>
            ← Geri Dön
          </button>
          <h2>Profil</h2>
          <div className="header-spacer"></div>
        </div>

        {/* Profile Image Section */}
        <div className="profil-image-section">
          <div className="profil-image-wrapper" onClick={handleImageClick}>
            {(() => {
              // Backend'den gelen field ismi avatarUrl veya avatar_url olabilir
              const avatarUrl = user.avatar_url || user.avatarUrl;
              
              return avatarUrl ? (
                <img 
                  src={fileUrl(avatarUrl)} 
                  alt="Profil" 
                  className="profil-image"
                />
              ) : (
                <div className="profil-initials">
                  {getInitials()}
                </div>
              );
            })()}
            <div className="image-overlay">
              {uploading ? (
                <div className="upload-spinner"></div>
              ) : (
                <span className="camera-icon">📷</span>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
          <p className="image-hint">Profil resmini değiştirmek için tıkla</p>
        </div>

        {/* Message Display */}
        {msg && (
          <div className={`message ${msg.includes("başarıyla") ? "success" : "error"}`}>
            {msg}
          </div>
        )}

        {/* Profile Information */}
        <div className="profil-info-section">
          {!isEditing ? (
            <>
              <div className="info-row">
                <span className="info-label">Ad</span>
                <span className="info-value">{user.ad || "-"}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Soyad</span>
                <span className="info-value">{user.soyad || "-"}</span>
              </div>
              <div className="info-row">
                <span className="info-label">E-posta</span>
                <span className="info-value">{user.email || "-"}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Sınıf</span>
                <span className="info-value">
                  {user.sinif ? `${user.sinif}. Sınıf` : "-"}
                </span>
              </div>
              {user.role === "ADMIN" && (
                <div className="info-row">
                  <span className="info-label">Rol</span>
                  <span className="info-value">
                    <span className={`role-badge ${user.role?.toLowerCase()}`}>
                      {user.role || "-"}
                    </span>
                  </span>
                </div>
              )}

              {/* Hedef Bilgileri */}
              {(hedefForm.universite || hedefForm.bolum) && (
                <div className="info-section-divider">
                  <span>🎯 Hedef Bilgileri</span>
                </div>
              )}
              {hedefForm.universite && (
                <div className="info-row">
                  <span className="info-label">Hedef Üniversite</span>
                  <span className="info-value">{hedefForm.universite}</span>
                </div>
              )}
              {hedefForm.bolum && (
                <div className="info-row">
                  <span className="info-label">Hedef Bölüm</span>
                  <span className="info-value">{hedefForm.bolum}</span>
                </div>
              )}
              {hedefForm.siralamaHedef && (
                <div className="info-row">
                  <span className="info-label">Hedef Sıralama</span>
                  <span className="info-value">{hedefForm.siralamaHedef.toLocaleString('tr-TR')}</span>
                </div>
              )}

              <button className="edit-button" onClick={() => setIsEditing(true)}>
                ✏️ Profili Düzenle
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Ad</label>
                <input
                  type="text"
                  value={editForm.ad}
                  onChange={(e) => setEditForm({ ...editForm, ad: e.target.value })}
                  placeholder="Adınız"
                />
              </div>
              <div className="form-group">
                <label>Soyad</label>
                <input
                  type="text"
                  value={editForm.soyad}
                  onChange={(e) => setEditForm({ ...editForm, soyad: e.target.value })}
                  placeholder="Soyadınız"
                />
              </div>
              <div className="form-group">
                <label>E-posta</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="E-posta adresiniz"
                />
              </div>

              {/* Sınıf Bilgisi - Sadece Göster */}
              <div className="form-group">
                <label>Sınıf</label>
                <input
                  type="text"
                  value={user.sinif ? `${user.sinif}. Sınıf` : "Belirtilmemiş"}
                  disabled
                  className="form-input-disabled"
                />
                <small className="form-hint">Sınıf bilgisi kayıt sırasında belirlenir ve değiştirilemez.</small>
              </div>

              {/* Hedef Bilgileri Bölümü */}
              <div className="info-section-divider">
                <span>🎯 Hedef Bilgileri</span>
              </div>

              <div className="form-group">
                <label>Hedef Üniversite</label>
                <input
                  type="text"
                  value={hedefForm.universite}
                  onChange={(e) => setHedefForm({ ...hedefForm, universite: e.target.value })}
                  placeholder="Örn: Marmara Üniversitesi"
                />
              </div>

              <div className="form-group">
                <label>Hedef Bölüm</label>
                <input
                  type="text"
                  value={hedefForm.bolum}
                  onChange={(e) => setHedefForm({ ...hedefForm, bolum: e.target.value })}
                  placeholder="Örn: Bilgisayar Mühendisliği"
                />
              </div>

              <div className="form-group">
                <label>Hedef Sıralama</label>
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  value={hedefForm.siralamaHedef}
                  onChange={(e) => setHedefForm({ ...hedefForm, siralamaHedef: parseInt(e.target.value) || 10000 })}
                  placeholder="10000"
                />
                <small className="form-hint">TYT/AYT için hedeflediğiniz sıralama (örn: 10000)</small>
              </div>

              <div className="button-group">
                <button className="save-button" onClick={handleSaveProfile} disabled={loading}>
                  {loading ? "Kaydediliyor..." : "💾 Kaydet"}
                </button>
                <button className="cancel-button" onClick={handleCancelEdit} disabled={loading}>
                  ✖️ İptal
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
