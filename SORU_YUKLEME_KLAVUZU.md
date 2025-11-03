# Toplu Soru Yükleme Klavuzu

## Excel/CSV Şablon Formatı

### Dosya Formatı
- **Dosya Türü:** CSV (virgülle ayrılmış değerler) veya Excel (.xlsx)
- **Encoding:** UTF-8
- **Şablon Dosya:** `public/soru-yukleme-sablonu.csv`

### Sütunlar

| Sütun Adı | Zorunlu | Açıklama | Örnek |
|-----------|---------|----------|-------|
| **soru_metni** | ✅ Evet | Soru metni | "2 + 2 işleminin sonucu kaçtır?" |
| **sik_a** | ✅ Evet | A şıkkı | "2" |
| **sik_b** | ✅ Evet | B şıkkı | "3" |
| **sik_c** | ✅ Evet | C şıkkı | "4" |
| **sik_d** | ✅ Evet | D şıkkı | "5" |
| **sik_e** | ❌ Hayır | E şıkkı (opsiyonel) | "6" |
| **dogru_cevap** | ✅ Evet | Doğru şık (A, B, C, D veya E) | "C" |
| **zorluk** | ✅ Evet | Zorluk seviyesi (1-5) | 1 |
| **ders_adi** | ✅ Evet | Ders adı (sistemde olmalı) | "TYT Matematik" |
| **konu_adi** | ✅ Evet | Konu adı (sistemde olmalı) | "Temel İşlemler" |
| **aciklama** | ❌ Hayır | Soru açıklaması (opsiyonel) | "Bu basit bir toplama sorusudur" |

### Önemli Notlar

1. **Ders ve Konu Kontrolü:**
   - Yüklemeden önce sisteminizde ilgili ders ve konuların mevcut olduğundan emin olun
   - Admin Panel > Ders/Konu Yönetimi'nden kontrol edebilirsiniz

2. **Doğru Cevap:**
   - Sadece harf olarak yazın: A, B, C, D veya E
   - Büyük/küçük harf önemli değil

3. **Zorluk Seviyesi:**
   - 1: Çok Kolay
   - 2: Kolay
   - 3: Orta
   - 4: Zor
   - 5: Çok Zor

4. **Özel Karakterler:**
   - Virgül içeren metinler için çift tırnak kullanın: "Merhaba, dünya"
   - Matematiksel ifadeler: "x² + 2x - 1 = 0"

5. **Boş Şıklar:**
   - E şıkkı opsiyoneldir, boş bırakabilirsiniz
   - Diğer şıklar (A-D) zorunludur

## Kullanım Adımları

### 1. Şablon Dosyasını İndirin
- Admin Panel'den "Şablon İndir" butonuna tıklayın
- veya `public/soru-yukleme-sablonu.csv` dosyasını açın

### 2. Excel/CSV Dosyasını Doldurun
- Şablon formatına uygun olarak sorularınızı girin
- Örnek satırları inceleyip benzer şekilde ekleyin

### 3. Dosyayı Yükleyin
- Admin Panel > Toplu Soru Yükle
- Dosyanızı seçin ve "Önizle" butonuna tıklayın
- Soruları kontrol edin
- "Yükle" butonuna tıklayın

### 4. Sonuç
- Başarıyla yüklenen sorular gösterilir
- Hata olan satırlar için uyarı mesajı verilir

## Örnek CSV İçeriği

```csv
soru_metni,sik_a,sik_b,sik_c,sik_d,sik_e,dogru_cevap,zorluk,ders_adi,konu_adi,aciklama
"2 + 2 işleminin sonucu kaçtır?",2,3,4,5,,C,1,TYT Matematik,Temel İşlemler,Bu basit bir toplama sorusudur
"Türkiye'nin başkenti neresidir?",İstanbul,Ankara,İzmir,Bursa,,B,1,TYT Coğrafya,Türkiye Coğrafyası,
```

## Toplu JSON Formatı (İleri Düzey)

Teknik kullanıcılar için direkt JSON formatında da yükleme yapabilirsiniz:

```json
{
  "dersAdi": "TYT Matematik",
  "konuAdi": "Temel İşlemler",
  "sorular": [
    {
      "metin": "2 + 2 işleminin sonucu kaçtır?",
      "tip": "coktan_secmeli",
      "zorluk": 1,
      "aciklama": "Bu basit bir toplama sorusudur",
      "secenekler": [
        { "metin": "2", "dogru": false },
        { "metin": "3", "dogru": false },
        { "metin": "4", "dogru": true },
        { "metin": "5", "dogru": false }
      ]
    }
  ]
}
```

## Sık Sorulan Sorular

**S: Kaç soru yükleyebilirim?**
C: Tek seferde en fazla 500 soru yükleyebilirsiniz.

**S: Soru görseli ekleyebilir miyim?**
C: Şu anda toplu yüklemede görsel desteği yoktur. Görselleri soru yüklendikten sonra Admin Panel'den tek tek ekleyebilirsiniz.

**S: Ders veya konu sistemde yoksa ne olur?**
C: Yükleme işlemi hata verir. Önce ders ve konuları oluşturmanız gerekir.

**S: Hatalı bir satır varsa tüm yükleme iptal olur mu?**
C: Hayır. Sadece hatalı satırlar atlanır ve diğer sorular yüklenir. Hatalı satırlar size bildirilir.

## Destek

Sorun yaşarsanız veya yardıma ihtiyacınız varsa Admin Panel'deki yardım butonuna tıklayın.

