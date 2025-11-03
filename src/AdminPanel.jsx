import { useEffect, useMemo, useState } from "react";
import api, { fileUrl } from "./services/api";
import * as XLSX from 'xlsx';
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

  // --- deneme sınavı ---
  const [denemeSinaviAcik, setDenemeSinaviAcik] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvKategori, setCsvKategori] = useState(""); // 'TURKCE' | 'MATEMATIK' | 'SOSYAL' | 'FEN'
  const [csvDersId, setCsvDersId] = useState("");
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [yeniCsvDersAdi, setYeniCsvDersAdi] = useState("");
  const [csvDenemeModu, setCsvDenemeModu] = useState(false); // true = deneme sınavı, false = normal soru
  const [csvDenemeAdi, setCsvDenemeAdi] = useState(""); // "TYT Deneme 1" veya "AYT Deneme 1" gibi
  const [csvDenemeSinaviId, setCsvDenemeSinaviId] = useState(null); // Oluşturulan deneme_sinavi tablosundaki ID
  const [mevcutDenemeler, setMevcutDenemeler] = useState([]); // Mevcut denemeler listesi
  const [csvSeciliDenemeId, setCsvSeciliDenemeId] = useState(""); // Kullanıcının seçtiği deneme ID'si
  const [yeniDenemeOlustur, setYeniDenemeOlustur] = useState(true); // Yeni deneme mi oluştur, mevcut mu seç
  
  // --- admin panel tabs ---
  const [aktifAdminTab, setAktifAdminTab] = useState("sorular"); // "sorular" | "denemeler"
  const [denemeListesi, setDenemeListesi] = useState([]);
  const [denemeYukleniyor, setDenemeYukleniyor] = useState(false);

  async function ensureDersForKategori() {
    if (csvDersId) return csvDersId;
    // Varsayılan ders adları
    const kategoriToDersAd = {
      TURKCE: "Türkçe",
      MATEMATIK: "Matematik",
      SOSYAL: "Sosyal Bilimler",
      FEN: "Fen Bilimleri",
    };
    const dersAd = kategoriToDersAd[csvKategori];
    if (!dersAd) return null;

    // Mevcut derslerde ara
    const existing = dersler.find(d => (d.ad || "").toLowerCase() === dersAd.toLowerCase());
    if (existing) {
      setCsvDersId(String(existing.id));
      await fetchKonular(existing.id);
      return String(existing.id);
    }
    // Yoksa oluştur
    try {
      const { data } = await api.post('/api/ders', { ad: dersAd, kategori: csvKategori });
      setDersler((list) => [...list, data]);
      setCsvDersId(String(data.id));
      await fetchKonular(data.id);
      return String(data.id);
    } catch (e) {
      setMsg("Ders oluşturulamadı: " + errText(e));
      return null;
    }
  }

  async function createAndSelectCsvDers() {
    const ad = (yeniCsvDersAdi || "").trim();
    if (!ad) {
      setMsg("Lütfen ders adı girin.");
      return;
    }
    if (!csvKategori) {
      setMsg("Lütfen kategori seçin.");
      return;
    }
    try {
      const payload = { ad };
      // Sadece toplu yükleme için kategori bilgisini göndermeyi dene (backend destekliyorsa kullanır)
      payload.kategori = csvKategori; 
      const { data } = await api.post('/api/ders', payload);
      // ders listesine ekle ve seç
      setDersler((list) => [...list, data]);
      setCsvDersId(String(data.id));
      setYeniCsvDersAdi("");
      setMsg(`Ders oluşturuldu: ${data.ad}`);
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg("Ders oluşturulamadı: " + errText(e));
    }
  }

  const errText = (e) => {
    // Hata mesajını parse et
    if (e?.response?.data) {
      const data = e.response.data;
      // Eğer string ise direkt döndür
      if (typeof data === 'string') return data;
      // Eğer message varsa onu kullan
      if (data.message) return data.message;
      // Eğer error varsa onu kullan
      if (data.error) return data.error;
      // Obje ise JSON string'e çevir
      if (typeof data === 'object') {
        try {
          return JSON.stringify(data);
        } catch {
          return String(data);
        }
      }
      return String(data);
    }
    return e?.message || "Hata";
  };

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

  useEffect(() => {
    // Deneme modu açıldığında mevcut denemeleri çek
    if (csvDenemeModu && denemeSinaviAcik) {
      fetchMevcutDenemeler();
    }
  }, [csvDenemeModu, denemeSinaviAcik]);

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

  // --------- CSV TOPLU YÜKLEME ----------
  async function handleCsvFile(file) {
    if (!file) return;
    
    const isCSV = /\.csv$/i.test(file.name || "");

    // Ders seçilmemişse, kategoriye göre otomatik ders oluştur/ata
    if (!csvDersId && csvKategori) {
      await ensureDersForKategori();
    }
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let json = [];
        
        if (isCSV) {
          // Decode ArrayBuffer → try UTF-8 first, fallback to Windows-1254 (Turkish)
          const buffer = e.target.result;
          let text = "";
          try {
            text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
          } catch (_) {
            // ignore
          }
          // Heuristic: if mojibake patterns exist, fallback
          if (text.includes("Ã") || text.includes("Ä") || text.includes("�")) {
            try {
              text = new TextDecoder("windows-1254", { fatal: false }).decode(buffer);
            } catch (_) {
              // keep utf-8 text if fallback fails
            }
          }
          // Parse CSV string with XLSX
          const wb = XLSX.read(text, { type: 'string' });
          const sheetName = wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          json = XLSX.utils.sheet_to_json(ws);
        } else {
          // XLSX/XLS → parse as array buffer
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const sheetName = wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          json = XLSX.utils.sheet_to_json(ws);
        }
        if (!Array.isArray(json)) {
          throw new Error('Dosya sayfadan JSON\'a dönüştürülemedi. Şablon sütunlarını kontrol edin.');
        }
        
        // CSV'yi parse et ve önizle
        const errors = [];
        const parsed = [];
        json.forEach((row, index) => {
          try {
            // Normalize doğru cevap harfi (A/B/C/D/E), sonundaki parantez/işaretleri temizle
            let dogruCevap = (row.dogru_cevap || row.dogru || '').toString().trim().toUpperCase();
            dogruCevap = dogruCevap.replace(/[^A-E]/g, ''); // A-E dışı karakterleri at

            // Konuları parse et (virgülle ayrılmış olabilir)
            // Önce "konular" sütununu kontrol et, yoksa "konu" veya "konu_adi" sütununu kullan
            const konularStr = (row.konular || row.konu || row.konu_adi || '').toString();
            const konularArray = konularStr.split(',').map(k => k.trim()).filter(k => k);

            const metin = (row.soru_metni || row.metin || '').toString().trim();
            const seceneklerAll = [
              { label: 'A', metin: (row.sik_a || row.a || '').toString().trim(), dogru: dogruCevap === 'A' },
              { label: 'B', metin: (row.sik_b || row.b || '').toString().trim(), dogru: dogruCevap === 'B' },
              { label: 'C', metin: (row.sik_c || row.c || '').toString().trim(), dogru: dogruCevap === 'C' },
              { label: 'D', metin: (row.sik_d || row.d || '').toString().trim(), dogru: dogruCevap === 'D' },
              { label: 'E', metin: (row.sik_e || row.e || '').toString().trim(), dogru: dogruCevap === 'E' },
            ].filter(s => s.metin);

            if (!metin) throw new Error('Boş soru metni');
            if (seceneklerAll.length < 2) throw new Error('En az iki şık olmalı');

            // Eğer doğru şık yoksa ilk şıkkı doğru olarak kabul etmeyelim; backend reddedebilir
            const hasDogru = seceneklerAll.some(s => s.dogru);
            if (!hasDogru && dogruCevap) {
              // Dogru cevap harfi var ama o şık boş olabilir; bu durumda uyarı ama ekle
            }

            parsed.push({
              rowIndex: index + 2,
              metin,
              secenekler: seceneklerAll,
              konular: konularArray,
              zorluk: parseInt(row.zorluk) || 1,
              aciklama: (row.aciklama || '').toString(),
              dersAdi: (row.ders_ad || row.ders_adi || row.ders || '').toString().trim(), // Backend ders_ad bekliyor
              dersId: row.ders_id || row.dersId ? parseInt(row.ders_id || row.dersId) : null, // Ders ID varsa kullan
              dogruCevap: dogruCevap || (hasDogru ? seceneklerAll.find(s => s.dogru)?.label : null), // A, B, C, D, E
            });
          } catch (er) {
            errors.push(`Satır ${index + 2}: ${er.message}`);
          }
        });
        if (errors.length) {
          console.warn('CSV satır hataları:', errors.slice(0, 5));
        }
        
        setCsvPreview(parsed);
        setMsg(`${parsed.length} soru önizlendi. Kontrol edip yükleyin.`);
      } catch (error) {
        setMsg("CSV dosyası okunamadı: " + error.message);
        console.error(error);
      }
    };
    // Read strategy per file type
    if (isCSV) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  async function uploadCsvSorular() {
    // Deneme modunda deneme kontrolü: Ya mevcut deneme seçilmeli ya da yeni deneme adı girilmeli
    if (csvDenemeModu) {
      if (yeniDenemeOlustur) {
        // Yeni deneme oluştur modunda: deneme adı gerekli
        if (!csvDenemeAdi || !csvDenemeAdi.trim()) {
          setMsg("Lütfen deneme adı girin! (Örn: TYT Deneme 1, AYT Deneme 1)");
          return;
        }
      } else {
        // Mevcut deneme seç modunda: deneme seçimi gerekli
        if (!csvSeciliDenemeId || csvSeciliDenemeId === "") {
          setMsg("Lütfen mevcut bir deneme seçin!");
          return;
        }
      }
    }

    if (!csvKategori) {
      setMsg("Lütfen bir kategori seçin!");
      return;
    }

    if (csvPreview.length === 0) {
      setMsg("Önce CSV dosyası yükleyin!");
      return;
    }

    setUploadingCsv(true);
    setMsg("");
    
    try {
      // Deneme modunda ise önce deneme_sinavi kaydı oluştur veya mevcut olanı kullan
      let denemeSinaviId = null;
      if (csvDenemeModu) {
        // Eğer kullanıcı mevcut deneme seçmişse onu kullan
        if (csvSeciliDenemeId && csvSeciliDenemeId !== "") {
          denemeSinaviId = Number(csvSeciliDenemeId);
          const seciliDeneme = mevcutDenemeler.find(d => 
            (d.id || d.deneme_sinavi_id) === denemeSinaviId
          );
          
          if (!seciliDeneme) {
            setMsg("Seçilen deneme bulunamadı! Lütfen tekrar deneyin.");
            setUploadingCsv(false);
            return;
          }
          
          console.log("Mevcut deneme kullanılıyor:", denemeSinaviId, seciliDeneme?.adi);
          setMsg(`Mevcut deneme kullanılıyor: ${seciliDeneme?.adi || seciliDeneme?.deneme_adi || 'Deneme'}`);
        }
        // Yeni deneme oluşturulacaksa veya isim girilmişse
        else if (csvDenemeAdi.trim()) {
          try {
            // Önce aynı isimde deneme var mı kontrol et
            const ayniIsimdeDeneme = mevcutDenemeler.find(d => 
              (d.adi || d.deneme_adi || "").toLowerCase().trim() === csvDenemeAdi.trim().toLowerCase()
            );

            if (ayniIsimdeDeneme) {
              // Aynı isimde deneme var, onu kullan
              denemeSinaviId = ayniIsimdeDeneme.id || ayniIsimdeDeneme.deneme_sinavi_id;
              setCsvSeciliDenemeId(String(denemeSinaviId));
              setMsg(`Mevcut deneme kullanılıyor: ${csvDenemeAdi}`);
              console.log("Aynı isimde deneme bulundu, kullanılıyor:", denemeSinaviId);
            } else {
              // Yeni deneme oluştur
              const denemeAdiUpper = csvDenemeAdi.toUpperCase();
              let kategori = "TYT"; // varsayılan
              if (denemeAdiUpper.includes("TYT")) {
                kategori = "TYT";
              } else if (denemeAdiUpper.includes("AYT")) {
                kategori = "AYT";
              }

              console.log("Yeni deneme sınavı oluşturuluyor:", { adi: csvDenemeAdi.trim(), kategori });
              
              // Backend API: POST /api/deneme-sinavi (tekil)
              const { data: denemeSinavi } = await api.post("/api/deneme-sinavi", {
                adi: csvDenemeAdi.trim(),
                kategori: kategori
              });
              
              console.log("Deneme sınavı oluşturuldu:", denemeSinavi);
              denemeSinaviId = denemeSinavi.id;
              setCsvDenemeSinaviId(denemeSinaviId);
              
              // Mevcut denemeler listesini güncelle
              await fetchMevcutDenemeler();
              
              setMsg(`Yeni deneme sınavı oluşturuldu: ${csvDenemeAdi}`);
            }
          } catch (denemeError) {
            console.error("Deneme sınavı oluşturulamadı - Detaylı hata:", denemeError);
            console.error("Hata response:", denemeError?.response);
            console.error("Hata data:", denemeError?.response?.data);
            const errorMsg = errText(denemeError);
            setMsg("Deneme sınavı oluşturulamadı: " + errorMsg);
            setUploadingCsv(false);
            return;
          }
        }
        
        // Deneme modunda ama denemeSinaviId hala null ise hata
        if (csvDenemeModu && !denemeSinaviId) {
          setMsg("Deneme sınavı seçilemedi veya oluşturulamadı! Lütfen tekrar deneyin.");
          setUploadingCsv(false);
          return;
        }
      }
      // Ders ve konular için cache'ler
      const dersByNameCache = {}; // { dersAdi: {id, ad} }
      const konularByDersId = {}; // { [dersId]: konuList }

      // Eğer üstte seçili bir ders varsa onun konularını al
      if (csvDersId) {
        const resp = await api.get("/api/konu", { params: { dersId: Number(csvDersId) } });
        konularByDersId[csvDersId] = Array.isArray(resp.data) ? [...resp.data] : [];
      }
      
      let successCount = 0;
      let errorCount = 0;
      let createdKonular = {}; // Oluşturulan yeni konuları cache'le
      const errors = [];

      for (const soru of csvPreview) {
        try {
          // 0. Bu satır için kullanılacak ders: ÖNCE dersId kontrol et, yoksa dersAdi'ye bak
          let dersIdToUse = null;
          
          // ÖNCE: Eğer CSV'de ders_id varsa direkt kullan
          if (soru.dersId) {
            // Ders ID var, doğrula
            const dersObj = dersler.find(d => d.id === soru.dersId);
            if (dersObj) {
              dersIdToUse = String(soru.dersId);
            } else {
              errors.push(`Satır ${soru.rowIndex}: Ders ID ${soru.dersId} bulunamadı.`);
              errorCount++;
              continue;
            }
          }
          // YOKSA: dersAdi varsa isimle ara veya oluştur
          else if (soru.dersAdi) {
            const key = soru.dersAdi.toLowerCase();
            let dersObj = dersByNameCache[key] || dersler.find(d => (d.ad || '').toLowerCase() === key);
            if (!dersObj) {
              // yoksa oluştur
              try {
                const payload = { ad: soru.dersAdi };
                if (csvKategori) payload.kategori = csvKategori;
                const { data: yeniDers } = await api.post('/api/ders', payload);
                dersObj = yeniDers;
                setDersler((list) => [...list, yeniDers]);
              } catch (derr) {
                throw new Error(`Ders oluşturulamadı: ${soru.dersAdi}`);
              }
              dersByNameCache[key] = dersObj;
            }
            dersIdToUse = String(dersObj.id);
          }
          // HİÇBİRİ YOKSA: Seçili ders veya kategoriye göre otomatik
          else {
            const ensured = csvDersId || (await ensureDersForKategori());
            dersIdToUse = String(ensured);
          }

          // 1. Bu derse ait konuları hazırla
          if (!konularByDersId[dersIdToUse]) {
            const r = await api.get('/api/konu', { params: { dersId: Number(dersIdToUse) } });
            konularByDersId[dersIdToUse] = Array.isArray(r.data) ? [...r.data] : [];
          }
          const dersKonulari = konularByDersId[dersIdToUse];

          const konuIds = [];
          
          for (const konuAdi of soru.konular) {
            // Önce mevcut konularda ara
            let konu = dersKonulari.find(k => 
              k.ad.toLowerCase().trim() === konuAdi.toLowerCase().trim()
            );
            
            // Yoksa cache'de ara
            if (!konu && createdKonular[konuAdi]) {
              konu = createdKonular[konuAdi];
            }
            
            // Hala yoksa yeni konu oluştur
            if (!konu) {
              try {
                const { data: yeniKonu } = await api.post("/api/konu", {
                  dersId: Number(dersIdToUse),
                  ad: konuAdi
                });
                konu = yeniKonu;
                createdKonular[konuAdi] = konu;
                dersKonulari.push(konu); // Listeye ekle
              } catch (konuError) {
                console.error(`Konu oluşturulamadı: ${konuAdi}`, konuError);
              }
            }
            
            if (konu && konu.id) {
              konuIds.push(Number(konu.id));
            }
          }

          // 2. Soru oluştur
          // Deneme modunda ise özel endpoint kullan, normal modda standart endpoint
          let aciklama = soru.aciklama || null;
          
          let soruId;
          
          if (csvDenemeModu && denemeSinaviId) {
            // Deneme modunda: Backend API: POST /api/deneme-sinavlari/{denemeId}/sorular
            // Bu endpoint şıkları da içeriyor, ayrıca endpoint çağrısına gerek yok
            const denemeSoruPayload = {
              soruMetni: soru.metin,
              sikA: soru.secenekler[0]?.metin || "",
              sikB: soru.secenekler[1]?.metin || "",
              sikC: soru.secenekler[2]?.metin || "",
              sikD: soru.secenekler[3]?.metin || "",
              sikE: soru.secenekler[4]?.metin || null,
              dogruCevap: soru.dogruCevap, // A, B, C, D, E
              zorluk: Number(soru.zorluk) || 1,
              konular: soru.konular.join(','), // Virgülle ayrılmış string
              dersId: Number(dersIdToUse)
            };
            
            const soruResponse = await api.post(`/api/deneme-sinavlari/${denemeSinaviId}/sorular`, denemeSoruPayload);
            soruId = soruResponse.data.id;
            // Şıklar zaten eklendi, ayrıca eklemeye gerek yok
          } else {
            // Normal mod: Standart soru ekleme
            const soruPayload = {
              dersId: Number(dersIdToUse),
              konuIds: konuIds.length > 0 ? konuIds : [],
              metin: soru.metin,
              tip: "coktan_secmeli",
              zorluk: Number(soru.zorluk) || 1,
              aciklama: aciklama
            };

            const soruResponse = await api.post("/api/sorular", soruPayload);
            soruId = soruResponse.data.id;

            // 3. Şıkları ekle (sadece normal modda)
            for (let i = 0; i < soru.secenekler.length; i++) {
              const secenek = soru.secenekler[i];
              await api.post(`/api/sorular/${soruId}/secenekler`, {
                metin: secenek.metin,
                dogru: secenek.dogru,
                siralama: i + 1,
              });
            }
          }

          successCount++;
        } catch (e) {
          errorCount++;
          errors.push(`Satır ${soru.rowIndex}: ${errText(e)}`);
          console.error(`Soru ${soru.rowIndex} eklenemedi:`, e);
        }
      }

      // Konuları yenile
      if (Object.keys(createdKonular).length > 0) {
        fetchKonular(csvDersId);
      }

      // Sonuç mesajı
      const yeniKonuCount = Object.keys(createdKonular).length;
      let mesaj = `✓ ${successCount} soru yüklendi!`;
      if (yeniKonuCount > 0) {
        mesaj += ` (${yeniKonuCount} yeni konu oluşturuldu)`;
      }
      if (errorCount > 0) {
        mesaj = `${successCount} soru yüklendi, ${errorCount} hata oluştu.`;
      }
      
      setMsg(mesaj);
      if (errorCount > 0) {
        console.error("Hatalar:", errors);
      }

      // Temizle ve yenile
      setCsvPreview([]);
      fetchSorular();
      if (csvDenemeModu) {
        fetchDenemeListesi(); // Deneme listesini yenile
      }
      
      // Temizle ve yenile
      setCsvPreview([]);
      fetchSorular();
      if (csvDenemeModu) {
        fetchDenemeListesi(); // Deneme listesini yenile
        fetchMevcutDenemeler(); // Mevcut denemeleri yenile
      }
      
      setTimeout(() => {
        setMsg("");
        // Form'u temizleme ama deneme modunu ve seçimi koru
        if (!csvDenemeModu) {
          setDenemeSinaviAcik(false);
        }
        // Deneme modunda ise sadece preview'ı temizle, deneme seçimini koru
        setCsvKategori("");
        setCsvDersId("");
      }, 5000);
      
    } catch (e) {
      setMsg("Toplu yükleme hatası: " + errText(e));
    } finally {
      setUploadingCsv(false);
    }
  }

  function downloadCsvTemplate() {
    const link = document.createElement('a');
    link.href = '/deneme-sinavi-sablon.csv';
    link.download = 'deneme-sinavi-sablon.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Mevcut denemeleri çek (seçim için)
  async function fetchMevcutDenemeler() {
    try {
      // Backend API: GET /api/deneme-sinavi (tekil)
      const { data } = await api.get("/api/deneme-sinavi");
      const denemeler = Array.isArray(data) ? data : [];
      
      // Backend response'da soruSayisi zaten var, ekstra sorgu gerekmez
      // Eğer yoksa, her deneme için soruları çek
      for (const deneme of denemeler) {
        if (deneme.soruSayisi === undefined) {
          try {
            const { data: sorular } = await api.get("/api/sorular", { 
              params: { denemeSinaviId: deneme.id, limit: 1000 } 
            });
            deneme.soruSayisi = Array.isArray(sorular) ? sorular.length : 0;
          } catch (e) {
            deneme.soruSayisi = 0;
          }
        }
      }
      
      setMevcutDenemeler(denemeler);
    } catch (e) {
      console.error("Mevcut denemeler alınamadı:", e);
      setMevcutDenemeler([]);
    }
  }

  // Deneme sınavı listesi
  async function fetchDenemeListesi() {
    setDenemeYukleniyor(true);
    try {
      // Backend API: GET /api/deneme-sinavi (tekil)
      let denemeler = [];
      try {
        const { data } = await api.get("/api/deneme-sinavi");
        denemeler = Array.isArray(data) ? data : [];
      } catch (e) {
        console.warn("Deneme sınavı listesi alınamadı, sorulardan parse edilecek:", e);
      }

      // Eğer deneme_sinavi tablosu boşsa, sorulardan parse et (fallback - eski veriler için)
      if (denemeler.length === 0) {
        const { data: tumSorular } = await api.get("/api/sorular", { params: { limit: 1000 } });
        const denemeGruplari = {};
        tumSorular.forEach(soru => {
          const denemeAdi = soru.denemeAdi || soru.deneme_adi || 
                           (soru.aciklama && soru.aciklama.match(/\[Deneme[^\]]+\]/)?.[0]?.replace(/[\[\]]/g, ''));
          if (denemeAdi) {
            if (!denemeGruplari[denemeAdi]) {
              denemeGruplari[denemeAdi] = [];
            }
            denemeGruplari[denemeAdi].push(soru);
          }
        });

        denemeler = Object.keys(denemeGruplari).map(adi => ({
          id: null,
          adi: adi,
          soruSayisi: denemeGruplari[adi].length,
          sorular: denemeGruplari[adi]
        }));
      } else {
        // Her deneme için sorularını çek
        for (const deneme of denemeler) {
          try {
            const denemeId = deneme.id || deneme.deneme_sinavi_id;
            console.log(`Deneme ${deneme.adi} (ID: ${denemeId}) için sorular çekiliyor...`);
            
            let sorular = [];
            
            // Önce özel endpoint'i dene: GET /api/deneme-sinavlari/{denemeId}/sorular
            try {
              const { data } = await api.get(`/api/deneme-sinavlari/${denemeId}/sorular`);
              sorular = Array.isArray(data) ? data : [];
              console.log(`Deneme ${deneme.adi} için özel endpoint'ten ${sorular.length} soru bulundu`);
            } catch (e1) {
              console.log(`Özel endpoint çalışmadı, standart endpoint deneniyor...`);
              // Özel endpoint çalışmazsa standart endpoint'i dene
              try {
                const { data } = await api.get("/api/sorular", { 
                  params: { denemeSinaviId: denemeId, limit: 1000 } 
                });
                sorular = Array.isArray(data) ? data : [];
                console.log(`Deneme ${deneme.adi} için standart endpoint'ten ${sorular.length} soru bulundu`);
              } catch (e2) {
                console.error(`Standart endpoint de çalışmadı:`, e2);
                // Son çare: tüm soruları çek ve filtrele
                try {
                  const { data: tumSorular } = await api.get("/api/sorular", { params: { limit: 1000 } });
                  sorular = Array.isArray(tumSorular) ? tumSorular.filter(s => 
                    (s.denemeSinaviId || s.deneme_sinavi_id) === denemeId
                  ) : [];
                  console.log(`Deneme ${deneme.adi} için filtreleme ile ${sorular.length} soru bulundu`);
                } catch (e3) {
                  console.error(`Tüm sorular çekilemedi:`, e3);
                }
              }
            }
            
            console.log(`Deneme ${deneme.adi} için toplam ${sorular.length} soru bulundu`);
            deneme.sorular = sorular || [];
            deneme.soruSayisi = deneme.sorular.length;
          } catch (e) {
            console.error(`Deneme ${deneme.adi} soruları alınamadı:`, e);
            console.error("Hata detayları:", e.response?.data || e.message);
            deneme.sorular = [];
            deneme.soruSayisi = 0;
          }
        }
      }

      // adi field'ını normalize et
      const liste = denemeler.map(d => ({
        adi: d.adi || d.deneme_adi || 'İsimsiz Deneme',
        soruSayisi: d.soruSayisi || (d.sorular ? d.sorular.length : 0),
        sorular: d.sorular || []
      }));

      setDenemeListesi(liste);
    } catch (e) {
      setMsg("Deneme sınavları alınamadı: " + errText(e));
      setDenemeListesi([]);
    } finally {
      setDenemeYukleniyor(false);
    }
  }

  async function deleteDenemeSoru(soruId) {
    if (!confirm("Bu deneme sınavı sorusunu silmek istediğinizden emin misiniz?")) return;
    try {
      await api.delete(`/api/sorular/${soruId}`);
      setMsg("Soru başarıyla silindi!");
      fetchDenemeListesi();
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("Soru silinemedi: " + errText(e));
    }
  }

  async function fetchSorular() {
    if (!seciliDersId) return;
    setLoading(true);
    try {
      const params = { dersId: Number(seciliDersId), limit: 100 };
      if (listeKonuId) params.konuId = Number(listeKonuId);
      const { data } = await api.get("/api/sorular", { params });
      // Deneme sınavı sorularını filtrele (normal soru listesinde gösterilmemeli)
      const normalSorular = (data || []).filter(s => {
        const denemeAdi = s.denemeAdi || s.deneme_adi || 
                         (s.aciklama && s.aciklama.match(/\[Deneme[^\]]+\]/)?.[0]);
        return !denemeAdi; // Deneme sınavı sorularını çıkar
      });
      setSorular(normalSorular);
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setAktifAdminTab("sorular")}
              style={{
                padding: '8px 16px',
                background: aktifAdminTab === "sorular" ? 'white' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: aktifAdminTab === "sorular" ? 600 : 400,
                color: aktifAdminTab === "sorular" ? '#667eea' : '#6b7280',
                boxShadow: aktifAdminTab === "sorular" ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Sorular
            </button>
            <button
              type="button"
              onClick={() => {
                setAktifAdminTab("denemeler");
                fetchDenemeListesi();
              }}
              style={{
                padding: '8px 16px',
                background: aktifAdminTab === "denemeler" ? 'white' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: aktifAdminTab === "denemeler" ? 600 : 400,
                color: aktifAdminTab === "denemeler" ? '#667eea' : '#6b7280',
                boxShadow: aktifAdminTab === "denemeler" ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Deneme Sınavları
            </button>
          </div>
          <button 
            type="button" 
            onClick={() => (onBack ? onBack() : window.history.back())}
            className="admin-back-btn-header"
          >
            Geri Dön
          </button>
          </div>
        </div>

      {/* Main Content */}
      <div className="admin-main-content">
        {msg && (
          <div className={`admin-message ${msg.includes("başarı") || msg.includes("✓") ? "success" : msg.includes("Hata") || msg.includes("❌") ? "error" : "info"}`}>
            <span>{msg}</span>
          </div>
        )}

        {/* DENEME SINAVLARI SEKmesi */}
        {aktifAdminTab === "denemeler" && (
          <div className="admin-section-card">
            <div className="section-title">
              <span>Deneme Sınavları</span>
              <button
                type="button"
                onClick={() => {
                  setDenemeSinaviAcik(true);
                  setAktifAdminTab("sorular");
                }}
                className="admin-btn admin-btn-primary"
              >
                Yeni Deneme Ekle
              </button>
            </div>

            {denemeYukleniyor ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner"></div>
                <p>Deneme sınavları yükleniyor...</p>
              </div>
            ) : denemeListesi.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                <p>Henüz deneme sınavı eklenmemiş</p>
                <button
                  type="button"
                  onClick={() => {
                    setDenemeSinaviAcik(true);
                    setAktifAdminTab("sorular");
                  }}
                  className="admin-btn admin-btn-primary"
                  style={{ marginTop: '16px' }}
                >
                  İlk Deneme Sınavını Oluştur
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                {denemeListesi.map((deneme, idx) => (
                  <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', background: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{deneme.adi}</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                          {deneme.soruSayisi} soru
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`"${deneme.adi}" deneme sınavındaki tüm soruları silmek istediğinizden emin misiniz?`)) {
                            deneme.sorular.forEach(s => deleteDenemeSoru(s.id));
                          }
                        }}
                        className="admin-btn"
                        style={{ background: '#ef4444', color: 'white', padding: '6px 12px', fontSize: '13px' }}
                      >
                        Tümünü Sil
                      </button>
                    </div>
                    <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {deneme.sorular.slice(0, 10).map((soru, sIdx) => (
                          <div key={soru.id} style={{ 
                            padding: '8px', 
                            background: '#f9fafb', 
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 500 }}>
                                {sIdx + 1}. {soru.metin?.substring(0, 100)}...
                              </div>
                              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                                Ders: {soru.ders?.ad || '-'} | Konular: {soru.konular?.map(k => k.ad).join(', ') || '-'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => editSoru(soru)}
                                className="admin-btn admin-btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteDenemeSoru(soru.id)}
                                className="admin-btn"
                                style={{ padding: '4px 8px', fontSize: '12px', background: '#ef4444', color: 'white' }}
                              >
                                Sil
                              </button>
                            </div>
                          </div>
                        ))}
                        {deneme.sorular.length > 10 && (
                          <div style={{ padding: '8px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                            ... ve {deneme.sorular.length - 10} soru daha
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NORMAL SORULAR VE YÖNETİM (sorular tab'ında gösterilecek) */}
        {aktifAdminTab === "sorular" && (
          <>
        {/* TOPLU SORU YÜKLEME (DENEME SINAVI) */}
        <div className="admin-section-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', marginBottom: '24px' }}>
          <div className="section-title" style={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
            <span style={{ fontSize: '20px' }}>Deneme Sınavı Ekle (Toplu Soru Yükleme)</span>
            <button
              type="button"
              onClick={() => setDenemeSinaviAcik(!denemeSinaviAcik)}
              className="admin-btn admin-btn-secondary"
              style={{ background: 'white', color: '#667eea' }}
            >
              {denemeSinaviAcik ? 'Kapat' : 'Aç'}
            </button>
          </div>
          
          {denemeSinaviAcik && (
            <div style={{ padding: '20px', background: 'white', borderRadius: '0 0 12px 12px', color: '#111827' }}>
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#667eea' }}>Nasıl Çalışır?</h4>
                <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                  <li>Mod seçin: Deneme Sınavı veya Normal Soru</li>
                  <li>Kategori seçin (deneme modunda)</li>
                  <li>CSV/Excel dosyanızı yükleyin</li>
                  <li>Önizlemeyi kontrol edin</li>
                  <li>"Soruları Yükle" butonuna tıklayın</li>
                </ol>
                <div style={{ marginTop: '12px', padding: '8px', background: '#fff7ed', borderRadius: '4px', fontSize: '13px' }}>
                  💡 <strong>İpucu:</strong> CSV formatı (Backend formatına uygun):
                  <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                    <li><strong>ders_ad:</strong> Ders adı (örn: Matematik, Tarih, Coğrafya) - Sistem otomatik oluşturur/bulur</li>
                    <li><strong>konular:</strong> Virgülle ayrılmış konu listesi (örn: "Üslü Sayılar,Pisagor")</li>
                    <li><strong>Sıralama:</strong> soru_metni, sik_a, sik_b, sik_c, sik_d, sik_e, dogru_cevap, zorluk, konular, aciklama, ders_ad</li>
                    <li>Şablon dosyasını indirerek doğru formatı görebilirsiniz</li>
                  </ul>
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                    💡 <strong>Kolay Yol:</strong> CSV'de sadece <code>ders_ad</code> kullanın, sistem otomatik olarak dersi bulur veya oluşturur.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="admin-btn admin-btn-primary"
                  style={{ marginTop: '12px' }}
                >
                  Şablon Dosyasını İndir
                </button>
              </div>

              {/* Mod Seçimi */}
              <div className="admin-form-group" style={{ marginBottom: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <label className="admin-label" style={{ marginBottom: '12px', display: 'block' }}>Yükleme Modu</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={!csvDenemeModu}
                      onChange={() => {
                        setCsvDenemeModu(false);
                        setCsvDenemeAdi("");
                      }}
                    />
                    <span>Normal Soru Ekle</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={csvDenemeModu}
                      onChange={() => setCsvDenemeModu(true)}
                    />
                    <span>Deneme Sınavı Ekle</span>
                  </label>
                </div>
                {csvDenemeModu && (
                  <div style={{ marginTop: '12px' }}>
                    {/* Yeni Deneme / Mevcut Deneme Seçimi */}
                    <div style={{ marginBottom: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                        <input
                          type="radio"
                          checked={yeniDenemeOlustur}
                          onChange={() => {
                            setYeniDenemeOlustur(true);
                            setCsvSeciliDenemeId("");
                            setCsvDenemeAdi("");
                          }}
                        />
                        <span>Yeni Deneme Oluştur</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          checked={!yeniDenemeOlustur}
                          onChange={() => {
                            setYeniDenemeOlustur(false);
                            setCsvDenemeAdi("");
                          }}
                        />
                        <span>Mevcut Denemeyi Seç</span>
                      </label>
                    </div>

                    {yeniDenemeOlustur ? (
                      <>
                        <input
                          type="text"
                          className="admin-input"
                          placeholder="Deneme Sınavı Adı (örn: TYT Deneme 1, AYT Deneme 1)"
                          value={csvDenemeAdi}
                          onChange={(e) => setCsvDenemeAdi(e.target.value)}
                          required={csvDenemeModu}
                        />
                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                          Aynı isimde deneme varsa mevcut deneme kullanılır, yoksa yeni oluşturulur.
                          <br />
                          <strong>Önemli:</strong> Deneme adında "TYT" veya "AYT" geçerse otomatik kategorize edilir.
                        </p>
                      </>
                    ) : (
                      <>
                        <select
                          className="admin-input"
                          value={csvSeciliDenemeId}
                          onChange={(e) => setCsvSeciliDenemeId(e.target.value)}
                          required={csvDenemeModu && !yeniDenemeOlustur}
                        >
                          <option value="">-- Mevcut Deneme Seçin --</option>
                          {mevcutDenemeler.map((deneme) => (
                            <option key={deneme.id || deneme.deneme_sinavi_id} value={deneme.id || deneme.deneme_sinavi_id}>
                              {deneme.adi || deneme.deneme_adi || 'İsimsiz Deneme'} ({deneme.soruSayisi || 0} soru)
                            </option>
                          ))}
                        </select>
                        {mevcutDenemeler.length === 0 && (
                          <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>
                            Henüz deneme sınavı oluşturulmamış. "Yeni Deneme Oluştur" seçeneğini kullanın.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Kategori / Ders Seçimi / Hızlı Ders Oluştur (Sadece Toplu Yükleme için) */}
              <div className="admin-grid-2" style={{ marginBottom: '20px' }}>
                <div className="admin-form-group">
                  <label className="admin-label">Kategori Seç (Sadece Toplu Yükleme)</label>
                  <select
                    className="admin-input"
                    value={csvKategori}
                    onChange={(e) => setCsvKategori(e.target.value)}
                  >
                    <option value="">-- Kategori Seçin --</option>
                    <option value="TURKCE">Türkçe</option>
                    <option value="MATEMATIK">Matematik</option>
                    <option value="SOSYAL">Sosyal</option>
                    <option value="FEN">Fen</option>
                  </select>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                    Bu seçim sadece toplu yükleme akışı için etiket amaçlıdır.
                  </p>
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Ders Seç</label>
                  <select
                    className="admin-input"
                    value={csvDersId}
                    onChange={(e) => {
                      setCsvDersId(e.target.value);
                      if (e.target.value) {
                        fetchKonular(e.target.value);
                      }
                    }}
                    disabled={!csvKategori}
                  >
                    <option value="">-- Ders Seçin --</option>
                    {dersler.map((d) => (
                      <option key={d.id} value={d.id}>{d.ad}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                    Konular CSV'de belirtilecek. Yoksa otomatik oluşturulacak.
                  </p>
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Hızlı Ders Oluştur (örn: Fen Bilimleri)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="admin-input"
                      placeholder="Yeni ders adı"
                      value={yeniCsvDersAdi}
                      onChange={(e) => setYeniCsvDersAdi(e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={createAndSelectCsvDers}
                      disabled={!csvKategori}
                    >
                      Oluştur & Seç
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                    CSV'niz "Fen Bilimleri" diyorsa, önce burada dersi oluşturup seçin.
                  </p>
                </div>
              </div>

              {/* Dosya Yükleme */}
              <div className="admin-form-group" style={{ marginBottom: '20px' }}>
                <label className="admin-label">CSV/Excel Dosyası</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => handleCsvFile(e.target.files?.[0])}
                  className="admin-input"
                  style={{ padding: '8px' }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  Desteklenen formatlar: CSV, Excel (.xlsx, .xls). Her satırda "konular" sütunu olmalı.
                </p>
              </div>

              {/* Önizleme */}
              {csvPreview.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '12px' }}>Önizleme ({csvPreview.length} soru)</h4>
                  <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    {csvPreview.slice(0, 5).map((soru, index) => (
                      <div key={index} style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#f9fafb' : 'white' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                          {index + 1}. {soru.metin.substring(0, 100)}...
                        </div>
                        {soru.konular && soru.konular.length > 0 && (
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                            Konular: {soru.konular.join(', ')}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '13px' }}>
                          {soru.secenekler.map((sec, i) => (
                            <span
                              key={i}
                              style={{
                                padding: '4px 8px',
                                background: sec.dogru ? '#10b981' : '#e5e7eb',
                                color: sec.dogru ? 'white' : '#374151',
                                borderRadius: '4px'
                              }}
                            >
                              {sec.label}) {sec.metin.substring(0, 20)}...
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {csvPreview.length > 5 && (
                      <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                        ... ve {csvPreview.length - 5} soru daha
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Yükleme Butonu */}
              {csvPreview.length > 0 && (
                <button
                  type="button"
                  onClick={uploadCsvSorular}
                  disabled={uploadingCsv}
                  className="admin-btn admin-btn-primary"
                  style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                >
                  {uploadingCsv ? `Yükleniyor... (${csvPreview.length} soru)` : `${csvPreview.length} Soruyu Yükle`}
                </button>
              )}
            </div>
          )}
        </div>

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
              <span style={{ flex: 1 }}>Elimizdeki Sorular {sorular.length > 0 && `(${sorular.length})`}</span>
              <span style={{ fontSize: "11px", color: "#6b7280", marginRight: "12px", fontWeight: "normal" }}>
                Deneme sınavı soruları burada görünmez
              </span>
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
          </>
        )}
      </div>
    </div>
  );
}
