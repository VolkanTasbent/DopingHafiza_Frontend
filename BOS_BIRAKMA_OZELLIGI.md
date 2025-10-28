# ⭕ Boş Bırakma Özelliği

## 🎯 Özellik Açıklaması

Kullanıcılar artık soruları boş bırakabilirler. Boş bırakılan sorular:
- ✅ Puanlamada **0 puan** olarak hesaplanır (yanlış -1, doğru +3)
- ✅ Raporlarda **turuncu renk** ile işaretlenir
- ✅ Navigator'da görünür olur

---

## 🎨 UI/UX Değişiklikleri

### 1. **Soru Çöz Ekranı**

#### Boş Bırak Butonu
- Bir soruya cevap seçildiğinde **"⭕ Boş Bırak"** butonu görünür
- Butona tıklanınca seçim kaldırılır
- Turuncu gradient renk ile vurgulanır

#### İlerleme İstatistikleri
```
✅ 8 Cevaplanan
⭕ 2 Boş
🚩 3 İşaretli
```

#### Navigator
- **Yeşil**: Cevaplanan sorular
- **Gri**: Boş sorular
- **Sarı kenarlık**: İşaretli sorular

---

### 2. **Rapor Detay Ekranı**

#### Boş Cevap Gösterimi
- **Icon**: ⭕ (turuncu)
- **Metin**: "Boş Bırakıldı" (italik)
- **Arka plan**: Açık turuncu (#fffbeb)
- **Kenarlık**: Turuncu (#fed7aa)

#### Karşılaştırma
```
┌────────────────────┐      ┌────────────────────┐
│ ⭕ Senin Cevabın   │  →   │ ✅ Doğru Cevap     │
│ Boş Bırakıldı      │      │ A) Paris           │
└────────────────────┘      └────────────────────┘
```

---

## 📊 Backend Entegrasyonu

### API Payload
```javascript
{
  "items": [
    { "soruId": 1, "secenekId": 123 },     // Cevaplanan
    { "soruId": 2, "secenekId": null },    // Boş bırakılan
    { "soruId": 3, "secenekId": 456 }      // Cevaplanan
  ],
  "startedAt": "2025-10-28T12:00:00Z",
  "finishedAt": "2025-10-28T12:05:00Z"
}
```

### Database
- **Tablo**: `cevap`
- **Kolon**: `secenek_id` → `NULL` (boş bırakılanlar için)
- **Kolon**: `dogru` → `false` (boş = yanlış)

---

## 🎮 Kullanım Senaryoları

### Senaryo 1: Soruyu Boş Bırakma
1. Kullanıcı bir şık seçer
2. **"Boş Bırak"** butonuna tıklar
3. Seçim kaldırılır
4. Soru navigator'da gri renk olur

### Senaryo 2: Test Bitirme
1. Kullanıcı **"Testi Bitir"** butonuna basar
2. Boş bırakılan sorular da payload'a eklenir (`secenekId: null`)
3. Backend puanlamayı yapar:
   - Doğru: +3
   - Yanlış: -1
   - Boş: 0

### Senaryo 3: Rapor İnceleme
1. Kullanıcı raporu açar
2. **"Sadece Yanlışlar"** filtresini seçer
3. Hem yanlış hem boş cevaplar görünür
4. Boş cevaplar **turuncu** ile işaretli

---

## 🎨 CSS Sınıfları

### Soru Çöz
```css
.clear-btn              /* Boş Bırak butonu */
.navigator-item.empty   /* Navigator'da boş sorular (kullanılmıyor - gri default) */
```

### Rapor Detay
```css
.bos-cevap             /* Boş cevap kartı */
.bos-cevap .cevap-label  /* Turuncu etiket */
```

---

## ⚠️ Önemli Notlar

1. **Puanlama Sistemi**
   - Doğru: +3 puan
   - Yanlış: -1 puan
   - Boş: 0 puan (net hesabında etkilemez)

2. **Filtreleme**
   - "Sadece Yanlışlar" filtresinde boş cevaplar **görünür**
   - Çünkü boş = yanlış olarak işaretleniyor (`dogru: false`)

3. **Eski Veriler**
   - Database'de zaten 20 tane boş cevap (`secenek_id IS NULL`) var
   - Bu özellik eski verilerle uyumlu

---

## 🔄 Gelecek İyileştirmeler (Opsiyonel)

1. **Boş Cevap Filtresi**
   ```
   [Tüm Sorular] [Sadece Yanlışlar] [Sadece Boş Bırakılanlar]
   ```

2. **İstatistik Kartları**
   - Raporlarda boş sayısını ayrı göster
   ```
   ✅ 8 Doğru  |  ❌ 5 Yanlış  |  ⭕ 2 Boş
   ```

3. **Uyarı Sistemi**
   - "5 soru boş bıraktınız, emin misiniz?" uyarısı

---

## ✅ Test Checklist

- [x] Boş Bırak butonu görünüyor mu?
- [x] Butona basınca seçim kaldırılıyor mu?
- [x] Navigator'da boş sorular ayırt ediliyor mu?
- [x] İlerleme barında boş sayısı gösteriliyor mu?
- [x] Boş cevaplar backend'e `null` olarak gidiyor mu?
- [x] Raporlarda boş cevaplar turuncu görünüyor mu?
- [x] "Boş Bırakıldı" metni italik ve soluk mu?
- [x] Eski boş cevaplar düzgün görünüyor mu?

---

## 🎉 Sonuç

Boş bırakma özelliği başarıyla eklendi! Kullanıcılar artık:
- Soruları boş bırakabilir
- Boş bırakılan soruları takip edebilir
- Raporlarda boş cevapları görsel olarak ayırt edebilir

**Kullanıcı deneyimi önemli ölçüde iyileştirildi! 🚀**

