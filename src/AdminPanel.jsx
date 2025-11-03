import { useEffect, useMemo, useState } from "react";
import api, { fileUrl } from "./services/api";
import "./AdminPanel.css";

/** A–E hazır şıklar */
const LETTERS = ["A", "B", "C", "D", "E"];
const makeInitialOptions = () =>
  LETTERS.map((L, i) => ({ label: L, text: "", correct: i === 0, order: i + 1 }));

export default function AdminPanel({ onBack }) {
  // --- ders/konu ---
  const [dersler, setDersler] = useState([]);
  const [seciliDersId, setSeciliDersId] = useState("");
  const [yeniDers, setYeniDers] = useState("");

  const [konular, setKonular] = useState([]);
  const [seciliKonuIds, setSeciliKonuIds] = useState([]); // soru oluşturma için
  const [listeKonuId, setListeKonuId] = useState("");     // liste filtre

  const [yeniKonu, setYeniKonu] = useState("");

  // --- sorular ---
  const [sorular, setSorular] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- yeni soru formu ---
  const [form, setForm] = useState({
    metin: "",
    tip: "coktan_secmeli",
    zorluk: 1,
    soruNo: "",
    aciklama: "",
    imageUrl: "",
    videoUrl: "",
  });
  const [options, setOptions] = useState(makeInitialOptions());

  // --- ui ---
  const [msg, setMsg] = useState("");
  const [soruListesiAcik, setSoruListesiAcik] = useState(false);
  const [duzenlenenSoruId, setDuzenlenenSoruId] = useState(null);
  
  // --- döküman yükleme ---
  const [uploadingKonuId, setUploadingKonuId] = useState(null);
  const [uploadingVideoKonuId, setUploadingVideoKonuId] = useState(null);

  const errText = (e) =>
    e?.response?.data?.message || e?.response?.data || e?.message || "Hata";

  // --------- EFFECTS ----------
  useEffect(() => { fetchDersler(); }, []);

  useEffect(() => {
    if (seciliDersId) {
      fetchKonular(seciliDersId);
      // Soruları önceden yükle (düzenleme için gerekli)
      fetchSorular();
      setSeciliKonuIds([]);
    } else {
      setKonular([]); setSorular([]); setSeciliKonuIds([]);
    }
  }, [seciliDersId]);

  // --------- API CALLS ----------
  async function fetchDersler() {
    try {
      const { data } = await api.get("/api/ders");
      setDersler(data || []);
    } catch (e) { setMsg("Dersler alınamadı: " + errText(e)); }
  }

  async function addDers(e) {
    e.preventDefault();
    if (!yeniDers.trim()) return;
    try {
      await api.post("/api/ders", { ad: yeniDers.trim() });
      setYeniDers("");
      fetchDersler();
      setMsg("Ders başarıyla eklendi!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg("Ders eklenemedi: " + errText(e)); }
  }

  async function fetchKonular(dersId) {
    try {
      const { data } = await api.get("/api/konu", { params: { dersId } });
      setKonular(data || []);
    } catch (e) { setMsg("Konular alınamadı: " + errText(e)); }
  }

  async function addKonu(e) {
    e.preventDefault();
    if (!seciliDersId) return setMsg("Önce ders seçin.");
    if (!yeniKonu.trim()) return;
    try {
      await api.post("/api/konu", { dersId: Number(seciliDersId), ad: yeniKonu.trim() });
      setYeniKonu("");
      fetchKonular(seciliDersId);
      setMsg("Konu başarıyla eklendi!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg("Konu eklenemedi: " + errText(e)); }
  }

  async function uploadDokuman(konuId, file) {
    if (!file) return;
    
    // PDF kontrolü
    if (file.type !== "application/pdf") {
      return setMsg("Sadece PDF dosyaları yüklenebilir!");
    }
    
    // Boyut kontrolü (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return setMsg("PDF boyutu 10MB'dan küçük olmalıdır!");
    }
    
    setUploadingKonuId(konuId);
    setMsg("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("konuId", konuId);
      formData.append("dokumanAdi", file.name);
      
      await api.post("/api/files/upload-dokuman", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setMsg("PDF başarıyla yüklendi!");
      fetchKonular(seciliDersId);
      
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("PDF yüklenemedi: " + errText(e));
    } finally {
      setUploadingKonuId(null);
    }
  }

  async function uploadKonuVideosu(konuId, file) {
    if (!file) return;

    // Video dosya tipini kontrol et
    const videoMimeTypes = [
      'video/mp4',
      'video/mpeg',
      'video/x-mpeg',
      'video/x-mpeg-1',
      'video/x-mpeg-2',
      'video/x-ms-mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-matroska',
      'video/x-flv',
      'video/3gpp',
      'video/x-ms-wmv'
    ];

    const validExtensions = /\.(mp4|mov|avi|webm|mkv|flv|wmv|3gp|m4v)$/i;
    const hasValidExtension = validExtensions.test(file.name);
    const hasValidMimeType = file.type && (
      videoMimeTypes.includes(file.type) ||
      file.type.startsWith('video/')
    );

    const isValidVideo = hasValidExtension || hasValidMimeType;

    if (!isValidVideo) {
      setMsg("Lütfen geçerli bir video dosyası seçin (MP4, MOV, AVI, WEBM, MKV, FLV, WMV, 3GP, M4V)");
      setTimeout(() => setMsg(""), 3000);
      return;
    }

    // Dosya boyutunu kontrol et (max 500MB - konu anlatım videoları daha uzun olabilir)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      setMsg("Video dosyası çok büyük. Maksimum 500MB olmalıdır.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }

    setUploadingVideoKonuId(konuId);
    setMsg("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("konuId", konuId);
      
      const { data } = await api.post("/api/files/upload-konu-videosu", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setMsg("Konu anlatım videosu başarıyla yüklendi!");
      fetchKonular(seciliDersId);
      
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("Video yüklenemedi: " + errText(e));
    } finally {
      setUploadingVideoKonuId(null);
    }
  }

  async function deleteDokuman(konuId) {
    if (!confirm("PDF dökümanını silmek istediğinizden emin misiniz?")) return;
    
    try {
      await api.delete(`/api/files/dokuman/${konuId}`);
      setMsg("PDF dökümanı başarıyla silindi!");
      fetchKonular(seciliDersId);
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("PDF silinemedi: " + errText(e));
    }
  }

  async function deleteKonuVideosu(konuId) {
    if (!confirm("Konu anlatım videosunu silmek istediğinizden emin misiniz?")) return;
    
    try {
      await api.delete(`/api/files/konu-videosu/${konuId}`);
      setMsg("Konu anlatım videosu başarıyla silindi!");
      fetchKonular(seciliDersId);
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("Video silinemedi: " + errText(e));
    }
  }

  async function fetchSorular() {
    if (!seciliDersId) return;
    setLoading(true);
    try {
      const params = { dersId: Number(seciliDersId), limit: 100 };
      if (listeKonuId) params.konuId = Number(listeKonuId);
      const { data } = await api.get("/api/sorular", { params });
      setSorular(data || []);
      setMsg("");
    } catch (e) { 
      console.error("Sorular yüklenirken hata:", e);
      setMsg("Sorular alınamadı: " + errText(e)); 
    }
    finally { setLoading(false); }
  }

  async function deleteSoru(id) {
    if (!confirm("Soru silinsin mi?")) return;
    try { 
      await api.delete(`/api/sorular/${id}`); 
      await fetchSorular(); 
      setMsg("Soru başarıyla silindi!");
      setTimeout(() => setMsg(""), 3000);
    }
    catch (e) { setMsg("Soru silinemedi: " + errText(e)); }
  }

  async function deleteSecenek(id) {
    if (!confirm("Seçenek silinsin mi?")) return;
    try { 
      await api.delete(`/api/sorular/secenekler/${id}`); 
      await fetchSorular(); 
      setMsg("Seçenek başarıyla silindi!");
      setTimeout(() => setMsg(""), 3000);
    }
    catch (e) { setMsg("Seçenek silinemedi: " + errText(e)); }
  }

  // --------- UPLOAD ----------
  async function uploadImage(file) {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/api/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((s) => ({ ...s, imageUrl: data.url }));
      setMsg("Resim başarıyla yüklendi!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg("Resim yüklenemedi: " + errText(e)); }
  }

  async function uploadVideo(file) {
    if (!file) return;
    
    // Video dosya tipini kontrol et (MIME type veya dosya uzantısı)
    const videoMimeTypes = [
      'video/mp4',
      'video/mpeg',
      'video/x-mpeg',
      'video/x-mpeg-1',
      'video/x-mpeg-2',
      'video/x-ms-mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-matroska',
      'video/x-flv',
      'video/3gpp',
      'video/x-ms-wmv'
    ];
    
    // Dosya uzantısı kontrolü (daha güvenilir)
    const validExtensions = /\.(mp4|mov|avi|webm|mkv|flv|wmv|3gp|m4v)$/i;
    const hasValidExtension = validExtensions.test(file.name);
    
    // MIME type kontrolü
    const hasValidMimeType = file.type && (
      videoMimeTypes.includes(file.type) || 
      file.type.startsWith('video/')
    );
    
    const isValidVideo = hasValidExtension || hasValidMimeType;
    
    if (!isValidVideo) {
      setMsg("Lütfen geçerli bir video dosyası seçin (MP4, MOV, AVI, WEBM, MKV, FLV, WMV, 3GP, M4V)");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    
    // Dosya boyutunu kontrol et (örnek: 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setMsg("Video dosyası çok büyük. Maksimum 100MB olmalıdır.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/api/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((s) => ({ ...s, videoUrl: data.url }));
      setMsg("Video başarıyla yüklendi!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { 
      setMsg("Video yüklenemedi: " + errText(e)); 
    } finally {
      setSaving(false);
    }
  }

  // --------- QUESTION CREATE (with options) ----------
  const validOptionCount = useMemo(
    () => options.filter((o) => o.text.trim() !== "").length,
    [options]
  );
  const correctIndex = useMemo(
    () => options.findIndex((o) => o.correct),
    [options]
  );

  function setOptionText(idx, text) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text } : o)));
  }
  function setOptionCorrect(idx) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, correct: i === idx })));
  }
  function resetForm() {
    setForm({ metin: "", tip: "coktan_secmeli", zorluk: 1, soruNo: "", aciklama: "", imageUrl: "", videoUrl: "" });
    setOptions(makeInitialOptions());
    setSeciliKonuIds([]);
    setDuzenlenenSoruId(null);
  }

  async function editSoru(soru) {
    console.log("=== editSoru ÇAĞRILDI ===", soru);
    
    if (!soru || !soru.id) {
      setMsg("Soru verisi bulunamadı!");
      console.error("Soru verisi yok:", soru);
      return;
    }
    
    // Önce soruyu detaylı çek (tam veri için)
    let soruData = soru;
    try {
      console.log("API'den soru detayı çekiliyor, ID:", soru.id);
      const { data } = await api.get(`/api/sorular/${soru.id}`);
      console.log("API'den gelen veri:", data);
      if (data) {
        soruData = data;
      }
    } catch (e) {
      // API çalışmazsa mevcut veriyi kullan
      console.warn("Soru detayı alınamadı, mevcut veri kullanılıyor:", e);
    }
    
    console.log("Düzenlenecek soru verisi:", soruData);
    
    // State'leri güncelle
    setDuzenlenenSoruId(soruData.id);
    console.log("duzenlenenSoruId set edildi:", soruData.id);
    
    setForm({
      metin: soruData.metin || "",
      tip: soruData.tip || "coktan_secmeli",
      zorluk: soruData.zorluk || 1,
      soruNo: soruData.soruNo?.toString() || "",
      aciklama: soruData.aciklama || "",
      imageUrl: soruData.imageUrl || "",
      videoUrl: soruData.videoUrl || soruData.video_url || soruData.cozumUrl || soruData.cozum_url || soruData.cozumVideosuUrl || "",
    });
    
    // Konuları seç
    const konuIds = (soruData.konular || []).map(k => k.id);
    setSeciliKonuIds(konuIds);
    
    // Şıkları yükle - mevcut şıkları sıralı al
    const secenekler = (soruData.secenekler || []).sort((a, b) => (a.siralama || 0) - (b.siralama || 0));
    const newOptions = LETTERS.map((L, i) => {
      const secenek = secenekler[i];
      return {
        label: L,
        text: secenek?.metin || "",
        correct: secenek?.dogru === true || secenek?.dogru === 1,
        order: i + 1,
        secenekId: secenek?.id || null,
      };
    });
    setOptions(newOptions);
    
    console.log("Form state güncellendi:", {
      duzenlenenSoruId: soruData.id,
      formMetin: soruData.metin,
      konuIds: konuIds,
      secenekler: newOptions.map(o => ({ label: o.label, text: o.text, correct: o.correct }))
    });
    
    // Mesaj göster
    setMsg(`✅ Soru #${soruData.id} düzenleme moduna alındı. Form yukarıda açılacak.`);
    
    // Form bölümüne scroll - tüm section'ları kontrol et
    setTimeout(() => {
      const allCards = document.querySelectorAll('.admin-section-card');
      let found = false;
      allCards.forEach((card) => {
        const title = card.querySelector('.section-title');
        if (title) {
          const titleText = title.textContent || '';
          if (titleText.includes('Soru Oluştur') || titleText.includes('Soru Düzenle')) {
            console.log("Form kartı bulundu, scroll yapılıyor");
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            found = true;
            return;
          }
        }
      });
      if (!found) {
        console.warn("Form kartı bulunamadı!");
      }
      setTimeout(() => setMsg(""), 4000);
    }, 400);
  }

  async function createQuestion(e) {
    e.preventDefault();
    if (!seciliDersId) return setMsg("Önce ders seçin.");
    if (!form.metin.trim()) return setMsg("Soru metni boş olamaz.");
    if (seciliKonuIds.length === 0) return setMsg("En az bir konu seçmelisiniz.");
    if (validOptionCount < 2) return setMsg("En az iki şık doldurun.");
    if (correctIndex === -1) return setMsg("Bir doğru şık işaretleyin.");

    setSaving(true);
    try {
      if (duzenlenenSoruId) {
        // DÜZENLEME MODU
        // 1) Soruyu güncelle (video URL dahil)
        const videoUrlValue = form.videoUrl?.trim() || null;
        console.log("Soru güncelleniyor:", { soruId: duzenlenenSoruId, videoUrl: videoUrlValue });
        
        await api.put(`/api/sorular/${duzenlenenSoruId}`, {
          metin: form.metin.trim(),
          tip: form.tip || "coktan_secmeli",
          zorluk: Number(form.zorluk) || 1,
          imageUrl: form.imageUrl || null,
          aciklama: form.aciklama || null,
          soruNo: form.soruNo ? Number(form.soruNo) : null,
          konuIds: seciliKonuIds,
          cozumVideosuUrl: videoUrlValue, // Video URL'i doğrudan PUT'a ekle
        });
        
        console.log("Soru ve video URL başarıyla güncellendi");

        // 2) Mevcut şıkları güncelle/sil/ekle
        const filled = options.filter((o) => o.text.trim() !== "");
        const existingSecenekler = sorular.find(s => s.id === duzenlenenSoruId)?.secenekler || [];
        
        // Mevcut şıkları güncelle veya sil
        for (const existing of existingSecenekler) {
          const matchingOption = filled.find(o => o.secenekId === existing.id);
          if (matchingOption) {
            // Güncelle
            await api.put(`/api/sorular/secenekler/${existing.id}`, {
              metin: matchingOption.text.trim(),
              dogru: matchingOption.correct,
              siralama: matchingOption.order,
            });
          } else {
            // Sil (artık kullanılmıyor)
            await api.delete(`/api/sorular/secenekler/${existing.id}`);
          }
        }
        
        // Yeni şıklar ekle
        const newOptions = filled.filter(o => !o.secenekId);
        await Promise.all(
          newOptions.map((o) =>
            api.post(`/api/sorular/${duzenlenenSoruId}/secenekler`, {
              metin: o.text.trim(),
              dogru: o.correct,
              siralama: o.order,
            })
          )
        );

        resetForm();
        await fetchSorular();
        setMsg("Soru başarıyla güncellendi!");
        setTimeout(() => setMsg(""), 3000);
      } else {
        // YENİ SORU MODU
        // 1) Soru oluştur (video URL dahil)
        const videoUrlValue = form.videoUrl?.trim() || null;
        console.log("Yeni soru oluşturuluyor:", { dersId: seciliDersId, videoUrl: videoUrlValue });
        
        const { data: soru } = await api.post("/api/sorular", {
          dersId: Number(seciliDersId),
          konuIds: seciliKonuIds,
          metin: form.metin.trim(),
          tip: form.tip || "coktan_secmeli",
          zorluk: Number(form.zorluk) || 1,
          imageUrl: form.imageUrl || null,
          aciklama: form.aciklama || null,
          soruNo: form.soruNo ? Number(form.soruNo) : null,
          cozumVideosuUrl: videoUrlValue, // Video URL'i doğrudan POST'a ekle
        });

        // 2) A–E şıklarını ekle (boş olanları atla)
        const filled = options.filter((o) => o.text.trim() !== "");
        await Promise.all(
          filled.map((o) =>
            api.post(`/api/sorular/${soru.id}/secenekler`, {
              metin: o.text.trim(),
              dogru: o.correct,
              siralama: o.order,
            })
          )
        );
        
        console.log("Soru, şıklar ve video URL başarıyla eklendi");

        resetForm();
        await fetchSorular();
        setMsg("Soru ve şıklar başarıyla eklendi!");
        setTimeout(() => setMsg(""), 3000);
      }
    } catch (e) {
      setMsg((duzenlenenSoruId ? "Soru güncellenemedi" : "Soru eklenemedi") + ": " + errText(e));
    } finally {
      setSaving(false);
    }
  }

  // --------- RENDER ----------
  return (
    <div className="admin-container-wrapper">
      {/* Header */}
      <div className="admin-header-section">
        <div className="admin-header-content">
          <h1 className="admin-main-title">Admin Panel</h1>
          <p className="admin-subtitle-text">Ders, konu ve soru yönetim paneli</p>
        </div>
        <button 
          type="button" 
          onClick={() => (onBack ? onBack() : window.history.back())}
          className="admin-back-btn-header"
        >
          Geri Dön
        </button>
      </div>

      {/* Main Content */}
      <div className="admin-main-content">
        {msg && (
          <div className={`admin-message ${msg.includes("başarı") || msg.includes("✓") ? "success" : msg.includes("Hata") || msg.includes("❌") ? "error" : "info"}`}>
            <span>{msg}</span>
          </div>
        )}

        {/* DERS EKLE / SEÇ */}
        <div className="admin-section-card">
          <h2 className="section-title">Ders Yönetimi</h2>
          <div className="admin-grid-2">
            <div className="admin-form-group">
              <label className="admin-label">Ders Seçimi</label>
              <select 
                className="admin-select"
                value={seciliDersId} 
                onChange={(e) => setSeciliDersId(e.target.value)}
              >
                <option value="">— Ders seçin —</option>
                {dersler.map((d) => (
                  <option key={d.id} value={d.id}>{d.ad}</option>
                ))}
              </select>
            </div>

            <form onSubmit={addDers} className="admin-form-group">
              <label className="admin-label">Yeni Ders Ekle</label>
              <div className="admin-flex">
                <input 
                  className="admin-input"
                  placeholder="Yeni ders adı" 
                  value={yeniDers} 
                  onChange={(e) => setYeniDers(e.target.value)} 
                />
                <button type="submit" className="admin-btn admin-btn-primary">
                  Ders Ekle
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* KONU YÖNETİMİ */}
        {seciliDersId && (
          <div className="admin-section-card">
            <h2 className="section-title">Konu Yönetimi</h2>
            
            <div className="admin-form-group">
              <label className="admin-label">Konular (Soru Oluşturmak İçin Çoklu Seçim)</label>
              <div className="topic-tags-container">
                {konular.map((k) => (
                  <label key={k.id} className="topic-tag-label">
                    <input
                      type="checkbox"
                      className="topic-tag-checkbox"
                      checked={seciliKonuIds.includes(k.id)}
                      onChange={() =>
                        setSeciliKonuIds((prev) =>
                          prev.includes(k.id) ? prev.filter((x) => x !== k.id) : [...prev, k.id]
                        )
                      }
                    />
                    <span>{k.ad}</span>
                  </label>
                ))}
                {konular.length === 0 && (
                  <p style={{ color: "#6b7280", fontStyle: "italic" }}>Henüz konu eklenmemiş</p>
                )}
              </div>
            </div>

            <form onSubmit={addKonu} className="admin-form-group">
              <label className="admin-label">Yeni Konu Ekle</label>
              <div className="admin-flex">
                <input 
                  className="admin-input"
                  placeholder="Yeni konu adı" 
                  value={yeniKonu} 
                  onChange={(e) => setYeniKonu(e.target.value)} 
                />
                <button type="submit" className="admin-btn admin-btn-primary">
                  Konu Ekle
                </button>
              </div>
            </form>

            {/* KONU DÖKÜMAN YÖNETİMİ */}
            <div className="documents-section">
              <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "#111827" }}>
                Konu Dökümanları ve Videoları
              </h3>
              <div className="documents-list">
                {konular.map((k) => (
                  <div 
                    key={k.id} 
                    className={`document-item ${(k.dokumanUrl || k.dokuman_url) || (k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url) ? "has-document" : ""}`}
                  >
                    <div className="document-info">
                      <div className="document-name">{k.ad}</div>
                      <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                        {(k.dokumanUrl || k.dokuman_url) && (
                          <span style={{ marginRight: "8px" }}>PDF mevcut</span>
                        )}
                        {(k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url) && (
                          <span>Video mevcut</span>
                        )}
                        {!(k.dokumanUrl || k.dokuman_url) && !(k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url) && (
                          <span>Döküman ve video yüklenmedi</span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      {(k.dokumanUrl || k.dokuman_url) && (
                        <a 
                          href={fileUrl(k.dokumanUrl || k.dokuman_url)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="document-view-btn"
                          style={{ padding: "6px 12px", fontSize: "13px" }}
                        >
                          PDF Görüntüle
                        </a>
                      )}
                      
                      {(k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url) && (
                        <a 
                          href={fileUrl(k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="document-view-btn"
                          style={{ padding: "6px 12px", fontSize: "13px", background: "#dc2626" }}
                        >
                          Video İzle
                        </a>
                      )}
                      
                      <label className="document-upload-btn" style={{ padding: "6px 12px", fontSize: "13px" }}>
                        {uploadingKonuId === k.id ? "Yükleniyor..." : (k.dokumanUrl || k.dokuman_url) ? "PDF Değiştir" : "PDF Yükle"}
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => uploadDokuman(k.id, e.target.files?.[0])}
                          disabled={uploadingKonuId === k.id || uploadingVideoKonuId === k.id}
                          style={{ display: "none" }}
                        />
                      </label>
                      
                      <label className="document-upload-btn" style={{ padding: "6px 12px", fontSize: "13px", background: "#dc2626" }}>
                        {uploadingVideoKonuId === k.id ? "Yükleniyor..." : (k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url) ? "Video Değiştir" : "Video Yükle"}
                        <input
                          type="file"
                          accept="video/mp4,video/mpeg,video/quicktime,video/x-msvideo,video/webm,video/*,.mp4,.mov,.avi,.webm,.mkv,.flv,.wmv,.3gp,.m4v"
                          onChange={(e) => uploadKonuVideosu(k.id, e.target.files?.[0])}
                          disabled={uploadingKonuId === k.id || uploadingVideoKonuId === k.id}
                          style={{ display: "none" }}
                        />
                      </label>
                      
                      {(k.dokumanUrl || k.dokuman_url) && (
                        <button
                          type="button"
                          onClick={() => deleteDokuman(k.id)}
                          className="document-view-btn"
                          style={{ 
                            padding: "6px 12px", 
                            fontSize: "13px", 
                            background: "#ef4444",
                            border: "none",
                            cursor: "pointer",
                            color: "white"
                          }}
                          disabled={uploadingKonuId === k.id || uploadingVideoKonuId === k.id}
                        >
                          PDF Sil
                        </button>
                      )}
                      
                      {(k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url) && (
                        <button
                          type="button"
                          onClick={() => deleteKonuVideosu(k.id)}
                          className="document-view-btn"
                          style={{ 
                            padding: "6px 12px", 
                            fontSize: "13px", 
                            background: "#ef4444",
                            border: "none",
                            cursor: "pointer",
                            color: "white"
                          }}
                          disabled={uploadingKonuId === k.id || uploadingVideoKonuId === k.id}
                        >
                          Video Sil
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {konular.length === 0 && (
                  <p style={{ color: "#6b7280", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
                    Henüz konu eklenmemiş
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SORU OLUŞTUR / DÜZENLE */}
        {seciliDersId && (
          <div className="admin-section-card" style={{ 
            border: duzenlenenSoruId ? "2px solid #f59e0b" : "1px solid #e5e7eb",
            background: duzenlenenSoruId ? "#fffbeb" : "white"
          }}>
            <div className="section-title">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                <span>{duzenlenenSoruId ? `Soru Düzenle #${duzenlenenSoruId}` : "Soru Oluştur"}</span>
                {duzenlenenSoruId && (
                  <span style={{ 
                    fontSize: "12px", 
                    padding: "4px 12px", 
                    background: "#fef3c7", 
                    color: "#92400e",
                    borderRadius: "12px",
                    fontWeight: 600
                  }}>
                    Düzenleme Modu
                  </span>
                )}
              </div>
              {duzenlenenSoruId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    resetForm();
                    setMsg("Düzenleme iptal edildi.");
                    setTimeout(() => setMsg(""), 2000);
                  }}
                  className="admin-btn admin-btn-secondary"
                  style={{ padding: "8px 16px", fontSize: "14px" }}
                >
                  İptal
                </button>
              )}
            </div>
            <form onSubmit={createQuestion}>
              <div className="admin-form-group">
                <label className="admin-label">Soru Metni</label>
                <textarea
                  className="admin-textarea"
                  rows={4}
                  placeholder="Soru metnini buraya yazın"
                  value={form.metin}
                  onChange={(e) => setForm((s) => ({ ...s, metin: e.target.value }))}
                />
              </div>

              <div className="admin-grid-3">
                <div className="admin-form-group">
                  <label className="admin-label">Tip</label>
                  <input 
                    className="admin-input"
                    placeholder="coktan_secmeli" 
                    value={form.tip} 
                    onChange={(e) => setForm((s) => ({ ...s, tip: e.target.value }))} 
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Zorluk (1-5)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="5" 
                    className="admin-input"
                    placeholder="1" 
                    value={form.zorluk} 
                    onChange={(e) => setForm((s) => ({ ...s, zorluk: e.target.value }))} 
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Soru No (Opsiyonel)</label>
                  <input 
                    type="number" 
                    className="admin-input"
                    placeholder="Opsiyonel" 
                    value={form.soruNo} 
                    onChange={(e) => setForm((s) => ({ ...s, soruNo: e.target.value }))} 
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Açıklama (Opsiyonel)</label>
                <input 
                  className="admin-input"
                  placeholder="Açıklama" 
                  value={form.aciklama} 
                  onChange={(e) => setForm((s) => ({ ...s, aciklama: e.target.value }))} 
                />
              </div>

              {/* Görsel: URL veya dosya */}
              <div className="admin-form-group">
                <label className="admin-label">Görsel (Opsiyonel)</label>
                <div className="admin-flex">
                  <input 
                    className="admin-input"
                    placeholder="Görsel URL" 
                    value={form.imageUrl} 
                    onChange={(e) => setForm((s) => ({ ...s, imageUrl: e.target.value }))} 
                  />
                  <label className="admin-btn admin-btn-secondary">
                    Dosya Seç
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: "none" }}
                      onChange={(e) => uploadImage(e.target.files?.[0])} 
                    />
                  </label>
                </div>
                {form.imageUrl && (
                  <div className="image-preview-container">
                    <img src={fileUrl(form.imageUrl)} alt="preview" className="image-preview" />
                  </div>
                )}
              </div>

              {/* Çözüm Videosu: URL veya dosya */}
              <div className="admin-form-group">
                <label className="admin-label">Çözüm Videosu (Opsiyonel)</label>
                <div className="admin-flex">
                  <input 
                    className="admin-input"
                    type="text"
                    placeholder="Video URL veya dosya yolu (örn: https://youtube.com/... veya /files/...)" 
                    value={form.videoUrl} 
                    onChange={(e) => setForm((s) => ({ ...s, videoUrl: e.target.value }))} 
                  />
                  <label className="admin-btn admin-btn-secondary" style={{ whiteSpace: "nowrap" }}>
                    {saving ? "Yükleniyor..." : "Video Seç"}
                    <input 
                      type="file" 
                      accept="video/mp4,video/mpeg,video/quicktime,video/x-msvideo,video/webm,video/*,.mp4,.mov,.avi,.webm,.mkv,.flv,.wmv,.3gp,.m4v" 
                      style={{ display: "none" }}
                      onChange={(e) => uploadVideo(e.target.files?.[0])} 
                      disabled={saving}
                    />
                  </label>
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px" }}>
                  Video URL'si girebilir veya dosya olarak yükleyebilirsiniz (MP4, MOV, AVI, WEBM, maks. 100MB). 
                  Raporlarım sayfasında "Soru Çözümüne Git" butonu ile gösterilecektir.
                </p>
                {form.videoUrl && form.videoUrl.startsWith('/files/') && (
                  <div style={{ marginTop: "8px", padding: "8px", background: "#f0f9ff", borderRadius: "6px", fontSize: "12px", color: "#0369a1" }}>
                    ✓ Video yüklendi: {form.videoUrl}
                  </div>
                )}
              </div>

              {/* ŞIKLAR A–E */}
              <div className="options-container">
                <label className="admin-label">Şıklar (A-E)</label>
                {options.map((o, idx) => (
                  <div key={o.label} className="option-item">
                    <span className="option-label">{o.label}</span>
                    <input
                      className="admin-input"
                      placeholder={`${o.label} şıkkı metni`}
                      value={o.text}
                      onChange={(e) => setOptionText(idx, e.target.value)}
                    />
                    <label className="option-correct-radio">
                      <input
                        type="radio"
                        name="correct"
                        checked={o.correct}
                        onChange={() => setOptionCorrect(idx)}
                      />
                      <span>Doğru</span>
                    </label>
                  </div>
                ))}
                <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "12px" }}>
                  * En az iki şık doldurun. Birini "Doğru" seçin.
                </p>
              </div>

              <div className="admin-flex-end" style={{ marginTop: "24px" }}>
                <button type="submit" disabled={saving} className="admin-btn admin-btn-success">
                  {saving 
                    ? "Kaydediliyor..." 
                    : duzenlenenSoruId 
                      ? "Değişiklikleri Kaydet" 
                      : "Soru + Şıklar Ekle"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SORU LİSTESİ - TOGGLE İLE AÇILIR */}
        {seciliDersId && (
          <div className="admin-section-card">
            <div 
              className="section-title" 
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => {
                const yeniDurum = !soruListesiAcik;
                setSoruListesiAcik(yeniDurum);
                // Liste açılırken soruları yükle
                if (yeniDurum) {
                  fetchSorular();
                }
              }}
            >
              <span style={{ flex: 1 }}>Elimizdeki Sorular</span>
              <span style={{ fontSize: "20px", transition: "transform 0.3s", transform: soruListesiAcik ? "rotate(180deg)" : "rotate(0deg)" }}>
                ▼
              </span>
            </div>

            {soruListesiAcik && (
              <div style={{ animation: "fadeIn 0.3s ease-out" }}>
                <div className="questions-filter-bar">
                  <select 
                    className="admin-select"
                    value={listeKonuId} 
                    onChange={(e) => setListeKonuId(e.target.value)}
                  >
                    <option value="">Tüm konular</option>
                    {konular.map((k) => (
                      <option key={k.id} value={k.id}>{k.ad}</option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    onClick={fetchSorular} 
                    disabled={loading}
                    className="admin-btn admin-btn-secondary"
                  >
                    {loading ? "Yükleniyor..." : "Listeyi Yenile"}
                  </button>
                </div>

                {sorular.length === 0 && (
                  <p style={{ color: "#6b7280", fontStyle: "italic", textAlign: "center", padding: "40px" }}>
                    Seçilen ölçütlerde soru yok.
                  </p>
                )}

                <div className="questions-list-container">
                  {sorular.map((q) => (
                    <div key={q.id} className="question-card">
                      <div className="question-header">
                        <div className="question-text">{q.metin}</div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log("Düzenle butonuna tıklandı, soru ID:", q.id);
                              editSoru(q);
                            }} 
                            className="admin-btn"
                            style={{ 
                              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                              color: "white",
                              flexShrink: 0,
                              padding: "8px 16px",
                              fontSize: "14px",
                              cursor: "pointer"
                            }}
                          >
                            Düzenle
                          </button>
                          <button 
                            type="button" 
                            onClick={() => deleteSoru(q.id)} 
                            className="admin-btn admin-btn-danger"
                            style={{ flexShrink: 0, padding: "8px 16px", fontSize: "14px" }}
                          >
                            Sil
                          </button>
                        </div>
                      </div>

                      {/* konu rozetleri */}
                      {(q.konular || []).length > 0 && (
                        <div className="question-topics">
                          {(q.konular || []).map((k) => (
                            <span key={k.id} className="question-topic-badge">
                              {k.ad}
                            </span>
                          ))}
                        </div>
                      )}

                      {q.imageUrl && (
                        <img src={fileUrl(q.imageUrl)} alt="soru" className="question-image" />
                      )}

                      {/* mevcut şıklar */}
                      {(q.secenekler || []).length > 0 && (
                        <div className="question-options-list">
                          <label className="admin-label" style={{ marginBottom: "12px" }}>Şıklar</label>
                          {(q.secenekler || []).map((opt) => (
                            <div 
                              key={opt.id} 
                              className={`question-option-item ${opt.dogru ? "correct" : ""}`}
                            >
                              <div>
                                <span className="option-text" data-order={opt.siralama || ""}>
                                  {opt.metin}
                                </span>
                                {opt.dogru && (
                                  <span className="option-correct-badge">Doğru Cevap</span>
                                )}
                              </div>
                              <button 
                                type="button" 
                                onClick={() => deleteSecenek(opt.id)} 
                                className="admin-btn admin-btn-danger"
                                style={{ padding: "6px 12px", fontSize: "13px" }}
                              >
                                Sil
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
