# Backend - Video URL Kaydetme Hızlı Kurulum

Frontend'den video URL kaydetmek için backend'de yapılması gerekenler.

## 🔍 Sorun

Frontend'de `PUT /api/konu/{konuId}` endpoint'ine video URL gönderiliyor ama backend'de bu endpoint eksik veya çalışmıyor.

## ✅ Çözüm

### 1. Database Kontrolü

Önce database'de `konu_anlatim_videosu_url` kolonu var mı kontrol edin:

```sql
-- PostgreSQL
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'konu' AND column_name LIKE '%video%';

-- Eğer kolon yoksa ekleyin:
ALTER TABLE "konu" 
ADD COLUMN IF NOT EXISTS "konu_anlatim_videosu_url" TEXT;
```

### 2. Java Spring Boot - Hızlı Implementasyon

#### Konu Entity'ye Alan Ekleme (Eğer yoksa)

```java
@Entity
@Table(name = "konu")
public class Konu {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String ad;
    
    @Column(columnDefinition = "TEXT")
    private String aciklama;
    
    // ✅ Video URL alanı
    @Column(name = "konu_anlatim_videosu_url")
    private String konuAnlatimVideosuUrl;
    
    @Column(name = "dokuman_url")
    private String dokumanUrl;
    
    @ManyToOne
    @JoinColumn(name = "ders_id", nullable = false)
    private Ders ders;
    
    // Getters and Setters
    public String getKonuAnlatimVideosuUrl() {
        return konuAnlatimVideosuUrl;
    }
    
    public void setKonuAnlatimVideosuUrl(String konuAnlatimVideosuUrl) {
        this.konuAnlatimVideosuUrl = konuAnlatimVideosuUrl;
    }
}
```

#### DTO Oluşturma (Partial Update için)

```java
public class KonuUpdateDTO {
    private String ad;
    private String aciklama;
    private String konuAnlatimVideosuUrl;  // ✅ Video URL
    private String dokumanUrl;
    
    // Getters and Setters
    public String getKonuAnlatimVideosuUrl() {
        return konuAnlatimVideosuUrl;
    }
    
    public void setKonuAnlatimVideosuUrl(String konuAnlatimVideosuUrl) {
        this.konuAnlatimVideosuUrl = konuAnlatimVideosuUrl;
    }
    
    // Diğer getter/setter'lar...
}
```

#### Service Metodu

```java
@Service
public class KonuService {
    
    @Autowired
    private KonuRepository konuRepository;
    
    public Konu updateKonu(Long konuId, KonuUpdateDTO updateDTO) {
        Konu konu = konuRepository.findById(konuId)
            .orElseThrow(() -> new ResourceNotFoundException("Konu bulunamadı: " + konuId));
        
        // Sadece gönderilen alanları güncelle (partial update)
        if (updateDTO.getAd() != null && !updateDTO.getAd().trim().isEmpty()) {
            konu.setAd(updateDTO.getAd().trim());
        }
        
        if (updateDTO.getAciklama() != null) {
            konu.setAciklama(updateDTO.getAciklama().trim().isEmpty() ? null : updateDTO.getAciklama().trim());
        }
        
        // ✅ Video URL güncelleme (önemli!)
        if (updateDTO.getKonuAnlatimVideosuUrl() != null) {
            String videoUrl = updateDTO.getKonuAnlatimVideosuUrl().trim();
            konu.setKonuAnlatimVideosuUrl(videoUrl.isEmpty() ? null : videoUrl);
        }
        
        if (updateDTO.getDokumanUrl() != null) {
            String dokumanUrl = updateDTO.getDokumanUrl().trim();
            konu.setDokumanUrl(dokumanUrl.isEmpty() ? null : dokumanUrl);
        }
        
        return konuRepository.save(konu);
    }
}
```

#### Controller Endpoint

```java
@RestController
@RequestMapping("/api/konu")
@PreAuthorize("hasRole('ADMIN')")  // ✅ Admin yetkisi gerekli
public class KonuController {
    
    @Autowired
    private KonuService konuService;
    
    // ✅ Video URL kaydetmek için bu endpoint kullanılıyor
    @PutMapping("/{konuId}")
    public ResponseEntity<Konu> updateKonu(
            @PathVariable Long konuId,
            @RequestBody KonuUpdateDTO updateDTO) {
        
        Konu updatedKonu = konuService.updateKonu(konuId, updateDTO);
        return ResponseEntity.ok(updatedKonu);
    }
}
```

### 3. Python/Flask - Hızlı Implementasyon

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Konu, db
from functools import wraps

konu_bp = Blueprint('konu', __name__)

def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user = get_jwt_identity()
        if not current_user.get('role') == 'ADMIN':
            return jsonify({'error': 'Yetkisiz erişim'}), 403
        return f(*args, **kwargs)
    return decorated_function

@konu_bp.route('/api/konu/<int:konu_id>', methods=['PUT'])
@admin_required
def update_konu(konu_id):
    konu = Konu.query.get_or_404(konu_id)
    data = request.get_json()
    
    # ✅ Sadece gönderilen alanları güncelle
    if 'ad' in data and data['ad']:
        konu.ad = data['ad'].strip()
    
    if 'aciklama' in data:
        konu.aciklama = data['aciklama'].strip() if data['aciklama'] else None
    
    # ✅ Video URL güncelleme (önemli!)
    if 'konuAnlatimVideosuUrl' in data:
        video_url = data['konuAnlatimVideosuUrl'].strip() if data['konuAnlatimVideosuUrl'] else None
        konu.konu_anlatim_videosu_url = video_url
    
    if 'dokumanUrl' in data:
        konu.dokuman_url = data['dokumanUrl'].strip() if data['dokumanUrl'] else None
    
    db.session.commit()
    return jsonify(konu.to_dict()), 200
```

### 4. Node.js/Express - Hızlı Implementasyon

```javascript
const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { Konu } = require('../models');

// ✅ Video URL kaydetmek için bu endpoint
router.put('/api/konu/:konuId', authenticateAdmin, async (req, res) => {
  try {
    const { konuId } = req.params;
    const { ad, aciklama, konuAnlatimVideosuUrl, dokumanUrl } = req.body;
    
    const konu = await Konu.findByPk(konuId);
    if (!konu) {
      return res.status(404).json({ error: 'Konu bulunamadı' });
    }
    
    // Sadece gönderilen alanları güncelle
    if (ad !== undefined) konu.ad = ad?.trim() || null;
    if (aciklama !== undefined) konu.aciklama = aciklama?.trim() || null;
    
    // ✅ Video URL güncelleme (önemli!)
    if (konuAnlatimVideosuUrl !== undefined) {
      konu.konuAnlatimVideosuUrl = konuAnlatimVideosuUrl?.trim() || null;
    }
    
    if (dokumanUrl !== undefined) konu.dokumanUrl = dokumanUrl?.trim() || null;
    
    await konu.save();
    res.json(konu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

## 🧪 Test Etme

### cURL ile Test

```bash
# Video URL kaydetme testi
curl -X PUT http://localhost:8080/api/konu/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "konuAnlatimVideosuUrl": "https://www.youtube.com/watch?v=abc123"
  }'
```

**Beklenen Sonuç:** 200 OK, güncellenmiş konu objesi döner

### Frontend'den Test

1. Admin panelde bir konu seçin
2. "🔗 URL Ekle/Düzenle" butonuna tıklayın
3. Video URL girin (örn: `https://www.youtube.com/watch?v=...`)
4. "Kaydet" butonuna tıklayın
5. Başarı mesajı görünmeli ve konu listesi güncellenmeli

## ⚠️ Önemli Notlar

1. **Partial Update:** Frontend sadece `konuAnlatimVideosuUrl` gönderiyor, diğer alanlar (`ad`, `aciklama` vb.) gönderilmiyor. Backend'de sadece gönderilen alanları güncellemeli, diğerlerini değiştirmemelisiniz.

2. **Database Kolon Adı:** 
   - Frontend `konuAnlatimVideosuUrl` (camelCase) gönderiyor
   - Database'de `konu_anlatim_videosu_url` (snake_case) olabilir
   - Mapping'i doğru yapın

3. **Boş Değer:** Eğer URL boş string gönderilirse, `null` olarak kaydedin (silme işlemi gibi)

4. **Yetkilendirme:** Endpoint admin yetkisi gerektirmeli (`@PreAuthorize("hasRole('ADMIN')")` veya benzeri)

## 🔍 Debug İpuçları

Eğer hala çalışmıyorsa:

1. **Network Tab'ı kontrol edin:**
   - Request URL doğru mu? (`PUT /api/konu/{id}`)
   - Request body'de `konuAnlatimVideosuUrl` var mı?
   - Response status code nedir? (200, 404, 500?)

2. **Backend Log'ları kontrol edin:**
   - Endpoint'e istek geliyor mu?
   - Hata mesajı var mı?

3. **Database kontrolü:**
   ```sql
   SELECT id, ad, konu_anlatim_videosu_url 
   FROM konu 
   WHERE id = 1;
   ```

4. **CORS kontrolü:** Eğer CORS hatası varsa, backend'de CORS ayarlarını kontrol edin.

## 📝 Örnek Request/Response

**Request:**
```json
PUT /api/konu/1
{
  "konuAnlatimVideosuUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "ad": "Matematik - Fonksiyonlar",
  "aciklama": null,
  "konuAnlatimVideosuUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "dokumanUrl": null,
  "dersId": 1
}
```










