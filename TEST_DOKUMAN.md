# 🧪 Döküman Özelliği Test Rehberi

## 🎯 Test Adımları

### 1️⃣ Database Hazırlığı

```sql
-- 1. Kolonları ekle
ALTER TABLE konu 
ADD COLUMN IF NOT EXISTS dokuman_url TEXT,
ADD COLUMN IF NOT EXISTS dokuman_adi TEXT;

-- 2. Test verisi ekle
UPDATE konu 
SET dokuman_url = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    dokuman_adi = 'Test PDF Dökümanı'
WHERE id = (SELECT id FROM konu LIMIT 1);

-- 3. Kontrol et
SELECT id, ad, dokuman_url, dokuman_adi FROM konu WHERE dokuman_url IS NOT NULL;
```

---

### 2️⃣ Backend Test

1. **Backend'i yeniden başlat**
```bash
cd backend
./mvnw spring-boot:run
```

2. **API'yi test et**
```bash
# Konular listesini al
curl http://localhost:8080/api/konu?dersId=1
```

Çıktıda `dokumanUrl` ve `dokumanAdi` görünmeli:
```json
[
  {
    "id": 1,
    "ad": "Türev",
    "dokumanUrl": "https://www.w3.org/.../dummy.pdf",
    "dokumanAdi": "Test PDF Dökümanı"
  }
]
```

---

### 3️⃣ Frontend Test

1. **Uygulamayı yenile** (Ctrl+Shift+R)

2. **Derslerim → Detay** tıkla

3. **Konular** sekmesine git

4. Konu kartında şunları gör:
   - ✅ **"📄 PDF Var"** badge (sağ üstte)
   - ✅ **"📄 Döküman Görüntüle"** butonu (turuncu)

5. **"Döküman Görüntüle"** butonuna tıkla:
   - ✅ Modal açılmalı
   - ✅ PDF görünmeli
   - ✅ "PDF'i İndir" butonu çalışmalı
   - ✅ "Kapat" butonu modal'ı kapatmalı
   - ✅ Overlay'e tıklayınca modal kapanmalı

---

### 4️⃣ UI/UX Kontrolleri

| Test | Beklenen Sonuç | ✅/❌ |
|------|----------------|-------|
| Badge görünümü | Turuncu gradient, "📄 PDF Var" | |
| Buton renkleri | Primary: Mavi, Secondary: Turuncu | |
| Modal animasyonu | Fade in + slide up | |
| Modal header | Mor gradient, beyaz metin | |
| PDF viewer | Tam ekran, scrollable | |
| Download butonu | Yeşil gradient, yeni sekmede açılır | |
| Close butonu | X'e tıklayınca döner | |
| Responsive | Mobilde düzgün görünüm | |

---

### 5️⃣ Edge Case'ler

#### Test A: Dökümanı Olmayan Konu
```sql
-- Döküman URL'ini NULL yap
UPDATE konu SET dokuman_url = NULL WHERE id = 2;
```
**Beklenen:** 
- Badge görünmemeli
- Döküman butonu görünmemeli

#### Test B: Sadece URL, Adi Yok
```sql
UPDATE konu 
SET dokuman_url = 'https://example.com/test.pdf',
    dokuman_adi = NULL
WHERE id = 3;
```
**Beklenen:** 
- Modal başlığı: Konu adı kullanılmalı

#### Test C: Geçersiz URL
```sql
UPDATE konu 
SET dokuman_url = '/invalid/path.pdf'
WHERE id = 4;
```
**Beklenen:** 
- Modal açılmalı ama PDF yüklenmemeli
- Hata mesajı görünmeli

---

### 6️⃣ Performans Testi

```sql
-- 20 konuya döküman ekle
UPDATE konu 
SET dokuman_url = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    dokuman_adi = 'Test PDF'
WHERE id <= 20;
```

**Kontrol:**
- Sayfa hızlı yüklenmeli (<2 saniye)
- Modal açılışı smooth olmalı

---

### 7️⃣ Browser Compatibility

Test edilmesi gereken tarayıcılar:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Chrome
- [ ] Mobile Safari

---

### 8️⃣ Accessibility Test

- [ ] Keyboard navigation (Tab, Enter, Esc)
- [ ] Esc tuşu modal'ı kapatıyor mu?
- [ ] Focus trap (modal içinde kalıyor mu?)
- [ ] Screen reader uyumluluğu

---

## ✅ Tamamlanma Kriterleri

Aşağıdakilerin hepsi çalışıyor olmalı:

1. ✅ Database kolonları eklendi
2. ✅ Backend DTO güncellendi
3. ✅ API döküman bilgilerini döndürüyor
4. ✅ Frontend badge gösteriyor
5. ✅ Döküman butonu çalışıyor
6. ✅ Modal düzgün açılıyor/kapanıyor
7. ✅ PDF görüntüleniyor
8. ✅ Download butonu çalışıyor
9. ✅ Responsive tasarım düzgün
10. ✅ Animasyonlar smooth

---

## 🐛 Yaygın Hatalar & Çözümler

### Hata 1: "dokumanUrl is undefined"
**Çözüm:** Backend entity/DTO'ya alan eklenmiş mi kontrol edin.

### Hata 2: PDF görünmüyor
**Çözüm:** 
- Browser console'da CORS hatası var mı?
- PDF URL'i doğru mu?
- `fileUrl()` fonksiyonu çağrılıyor mu?

### Hata 3: Modal açılmıyor
**Çözüm:** 
- React state güncellemesi oldu mu?
- Console'da hata var mı?

### Hata 4: Download butonu çalışmıyor
**Çözüm:**
- `target="_blank"` var mı?
- URL doğru resolve ediliyor mu?

---

## 📸 Ekran Görüntüleri Kontrol Listesi

Test sırasında bu ekranları kontrol edin:

1. **Konu Listesi** - Badge görünümü
2. **Konu Kartı** - İki buton yan yana
3. **Modal Açık** - PDF görünümü
4. **Modal Header** - Mor gradient
5. **Modal Footer** - İki buton
6. **Mobile Görünüm** - Responsive

---

## 🎉 Test Tamamlandı!

Tüm testler geçtiyse özellik kullanıma hazır! 🚀

