# Backend Video URL Kaydetme Sorunu - Çözüm Rehberi

## 🔍 Sorun

Frontend'den video URL kaydediliyor ama backend'de kaydedilmiyor veya görünmüyor.

## ✅ Hızlı Kontrol Listesi

### 1. Database Kolonu Kontrolü

```sql
-- PostgreSQL - Kolon var mı kontrol et
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'konu' 
AND (column_name LIKE '%video%' OR column_name LIKE '%url%');

-- Eğer kolon yoksa ekle:
ALTER TABLE "konu" 
ADD COLUMN IF NOT EXISTS "konu_anlatim_videosu_url" TEXT;

-- Mevcut değerleri kontrol et
SELECT id, ad, konu_anlatim_videosu_url 
FROM konu 
WHERE id = 1;
```

### 2. Backend Endpoint Kontrolü

Frontend şu endpoint'e istek gönderiyor:
- **Method:** `PUT`
- **URL:** `/api/konu/{konuId}`
- **Body:** `{ "konuAnlatimVideosuUrl": "https://..." }`

Backend'de bu endpoint'in olup olmadığını kontrol edin.

### 3. Java Spring Boot - Tam Çözüm

#### Entity Kontrolü

```java
@Entity
@Table(name = "konu")
public class Konu {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String ad;
    
    // ✅ Video URL alanı - MUTLAKA OLMALI
    @Column(name = "konu_anlatim_videosu_url")
    private String konuAnlatimVideosuUrl;
    
    // Getter ve Setter MUTLAKA OLMALI
    public String getKonuAnlatimVideosuUrl() {
        return konuAnlatimVideosuUrl;
    }
    
    public void setKonuAnlatimVideosuUrl(String konuAnlatimVideosuUrl) {
        this.konuAnlatimVideosuUrl = konuAnlatimVideosuUrl;
    }
}
```

#### DTO - Partial Update İçin

```java
public class KonuUpdateDTO {
    private String ad;
    private String aciklama;
    private String konuAnlatimVideosuUrl;  // ✅ Bu alan MUTLAKA olmalı
    private String dokumanUrl;
    
    // Getter ve Setter
    public String getKonuAnlatimVideosuUrl() {
        return konuAnlatimVideosuUrl;
    }
    
    public void setKonuAnlatimVideosuUrl(String konuAnlatimVideosuUrl) {
        this.konuAnlatimVideosuUrl = konuAnlatimVideosuUrl;
    }
    
    // Diğer getter/setter'lar...
}
```

#### Service - ÖNEMLİ: Partial Update

```java
@Service
public class KonuService {
    
    @Autowired
    private KonuRepository konuRepository;
    
    public Konu updateKonu(Long konuId, KonuUpdateDTO updateDTO) {
        Konu konu = konuRepository.findById(konuId)
            .orElseThrow(() -> new ResourceNotFoundException("Konu bulunamadı: " + konuId));
        
        // ⚠️ ÖNEMLİ: Sadece gönderilen alanları güncelle!
        // Diğer alanları değiştirme (null yapma)!
        
        if (updateDTO.getAd() != null) {
            konu.setAd(updateDTO.getAd().trim());
        }
        // Eğer 'ad' gönderilmediyse, mevcut değeri koru
        
        if (updateDTO.getAciklama() != null) {
            konu.setAciklama(updateDTO.getAciklama().trim().isEmpty() ? null : updateDTO.getAciklama().trim());
        }
        
        // ✅ Video URL güncelleme - EN ÖNEMLİ KISIM
        if (updateDTO.getKonuAnlatimVideosuUrl() != null) {
            String videoUrl = updateDTO.getKonuAnlatimVideosuUrl().trim();
            konu.setKonuAnlatimVideosuUrl(videoUrl.isEmpty() ? null : videoUrl);
            System.out.println("Video URL güncelleniyor: " + videoUrl); // Debug için
        }
        
        if (updateDTO.getDokumanUrl() != null) {
            String dokumanUrl = updateDTO.getDokumanUrl().trim();
            konu.setDokumanUrl(dokumanUrl.isEmpty() ? null : dokumanUrl);
        }
        
        Konu saved = konuRepository.save(konu);
        System.out.println("Kaydedilen video URL: " + saved.getKonuAnlatimVideosuUrl()); // Debug için
        return saved;
    }
}
```

#### Controller

```java
@RestController
@RequestMapping("/api/konu")
@PreAuthorize("hasRole('ADMIN')")
public class KonuController {
    
    @Autowired
    private KonuService konuService;
    
    @PutMapping("/{konuId}")
    public ResponseEntity<Konu> updateKonu(
            @PathVariable Long konuId,
            @RequestBody KonuUpdateDTO updateDTO) {
        
        System.out.println("Update request - konuId: " + konuId); // Debug
        System.out.println("Update request - videoUrl: " + updateDTO.getKonuAnlatimVideosuUrl()); // Debug
        
        Konu updatedKonu = konuService.updateKonu(konuId, updateDTO);
        
        System.out.println("Updated konu video URL: " + updatedKonu.getKonuAnlatimVideosuUrl()); // Debug
        
        return ResponseEntity.ok(updatedKonu);
    }
}
```

### 4. Yaygın Hatalar ve Çözümleri

#### Hata 1: "Field konuAnlatimVideosuUrl not found"

**Sebep:** DTO'da getter/setter yok veya yanlış isimde.

**Çözüm:** DTO'da `getKonuAnlatimVideosuUrl()` ve `setKonuAnlatimVideosuUrl()` metodları olmalı.

#### Hata 2: "Column konu_anlatim_videosu_url does not exist"

**Sebep:** Database'de kolon yok.

**Çözüm:**
```sql
ALTER TABLE "konu" 
ADD COLUMN IF NOT EXISTS "konu_anlatim_videosu_url" TEXT;
```

#### Hata 3: Video URL kaydediliyor ama diğer alanlar siliniyor

**Sebep:** Partial update yapılmıyor, tüm alanlar güncelleniyor.

**Çözüm:** Service metodunda sadece `null` olmayan alanları güncelle:
```java
if (updateDTO.getAd() != null) {  // ✅ null kontrolü
    konu.setAd(updateDTO.getAd().trim());
}
// ❌ YANLIŞ: konu.setAd(updateDTO.getAd()); // null olabilir!
```

#### Hata 4: Response'da video URL görünmüyor

**Sebep:** Entity'den response'a mapping yapılırken video URL dahil edilmiyor.

**Çözüm:** Response DTO veya Entity'de video URL alanının getter'ı olmalı ve JSON'a dahil edilmeli.

### 5. Test Senaryosu

#### cURL ile Test

```bash
# 1. Video URL kaydet
curl -X PUT http://localhost:8080/api/konu/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "konuAnlatimVideosuUrl": "https://www.youtube.com/watch?v=test123"
  }'

# 2. Response'u kontrol et (video URL görünmeli)
# Beklenen response:
# {
#   "id": 1,
#   "ad": "Mevcut Konu Adı",
#   "konuAnlatimVideosuUrl": "https://www.youtube.com/watch?v=test123",
#   ...
# }

# 3. Database'den kontrol et
# SELECT id, ad, konu_anlatim_videosu_url FROM konu WHERE id = 1;
```

#### Frontend Console Kontrolü

1. Browser'da Developer Tools'u açın (F12)
2. Console tab'ına gidin
3. Video URL kaydetmeyi deneyin
4. Console'da şu log'ları görmelisiniz:
   - `Video URL kaydediliyor: { konuId: 1, videoUrl: "https://..." }`
   - `Backend response: { id: 1, konuAnlatimVideosuUrl: "https://...", ... }`

### 6. Debug Adımları

1. **Backend Log'larını Kontrol Edin:**
   - Request geldi mi?
   - DTO'da video URL var mı?
   - Service'de kaydedildi mi?
   - Response'da video URL var mı?

2. **Database'i Kontrol Edin:**
   ```sql
   SELECT * FROM konu WHERE id = 1;
   ```

3. **Network Tab'ını Kontrol Edin:**
   - Request body doğru mu?
   - Response status 200 mü?
   - Response body'de video URL var mı?

4. **Frontend Console'u Kontrol Edin:**
   - Hata mesajı var mı?
   - Response data doğru mu?

### 7. Hızlı Çözüm (Eğer Hala Çalışmıyorsa)

Backend'de şu endpoint'i ekleyin (geçici çözüm):

```java
@PutMapping("/{konuId}/video-url")
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<Konu> updateVideoUrl(
        @PathVariable Long konuId,
        @RequestBody Map<String, String> request) {
    
    Konu konu = konuRepository.findById(konuId)
        .orElseThrow(() -> new ResourceNotFoundException("Konu bulunamadı"));
    
    String videoUrl = request.get("konuAnlatimVideosuUrl");
    if (videoUrl != null) {
        konu.setKonuAnlatimVideosuUrl(videoUrl.trim());
        konuRepository.save(konu);
    }
    
    return ResponseEntity.ok(konu);
}
```

Ve frontend'de endpoint'i değiştirin:
```javascript
await api.put(`/api/konu/${konuId}/video-url`, {
  konuAnlatimVideosuUrl: videoUrlInput.trim()
});
```

## 📝 Özet

1. ✅ Database'de `konu_anlatim_videosu_url` kolonu olmalı
2. ✅ Entity'de `konuAnlatimVideosuUrl` field'ı ve getter/setter olmalı
3. ✅ DTO'da `konuAnlatimVideosuUrl` field'ı ve getter/setter olmalı
4. ✅ Service'de **partial update** yapılmalı (sadece gönderilen alanlar güncellenmeli)
5. ✅ Controller'da `PUT /api/konu/{konuId}` endpoint'i olmalı
6. ✅ Response'da video URL dönmeli

Bu adımları takip ederseniz video URL kaydetme sorunu çözülecektir.










