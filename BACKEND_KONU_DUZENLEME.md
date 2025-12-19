    # Backend Konu Düzenleme API Kurulumu

    Bu doküman, admin panelinde konu düzenleme özelliklerinin backend tarafında nasıl implement edileceğini açıklar.

    ## API Endpoint'leri

    ### 1. Konu Güncelleme (PUT)

    **Endpoint:** `PUT /api/konu/{konuId}`

    **Request Body:**
    ```json
    {
    "ad": "Güncellenmiş Konu Adı",
    "aciklama": "Konu açıklaması (opsiyonel)",
    "konuAnlatimVideosuUrl": "https://www.youtube.com/watch?v=... veya /files/video.mp4",
    "dokumanUrl": "/files/document.pdf"
    }
    ```

    **Response (200 OK):**
    ```json
    {
    "id": 1,
    "ad": "Güncellenmiş Konu Adı",
    "aciklama": "Konu açıklaması",
    "konuAnlatimVideosuUrl": "https://www.youtube.com/watch?v=...",
    "dokumanUrl": "/files/document.pdf",
    "dersId": 1
    }
    ```

    **Hata Durumları:**
    - `404 Not Found`: Konu bulunamadı
    - `400 Bad Request`: Geçersiz veri
    - `401 Unauthorized`: Yetkisiz erişim

    ### 2. Konu Silme (DELETE)

    **Endpoint:** `DELETE /api/konu/{konuId}`

    **Response (200 OK):**
    ```json
    {
    "message": "Konu başarıyla silindi"
    }
    ```

    **Hata Durumları:**
    - `404 Not Found`: Konu bulunamadı
    - `409 Conflict`: Konuya bağlı sorular var, silinemez
    - `401 Unauthorized`: Yetkisiz erişim

    ## Java Spring Boot Örnek Implementasyon

    ### Konu Entity (Güncellenmiş)

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
        
        @Column(name = "konu_anlatim_videosu_url")
        private String konuAnlatimVideosuUrl;
        
        @Column(name = "dokuman_url")
        private String dokumanUrl;
        
        @ManyToOne
        @JoinColumn(name = "ders_id", nullable = false)
        private Ders ders;
        
        // Getters and Setters
    }
    ```

    ### KonuDTO (Update için)

    ```java
    public class KonuUpdateDTO {
        private String ad;
        private String aciklama;
        private String konuAnlatimVideosuUrl;
        private String dokumanUrl;
        
        // Getters and Setters
    }
    ```

    ### KonuService

    ```java
    @Service
    public class KonuService {
        
        @Autowired
        private KonuRepository konuRepository;
        
        @Autowired
        private SoruRepository soruRepository;
        
        public Konu updateKonu(Long konuId, KonuUpdateDTO updateDTO) {
            Konu konu = konuRepository.findById(konuId)
                .orElseThrow(() -> new ResourceNotFoundException("Konu bulunamadı: " + konuId));
            
            if (updateDTO.getAd() != null && !updateDTO.getAd().trim().isEmpty()) {
                konu.setAd(updateDTO.getAd().trim());
            }
            
            konu.setAciklama(updateDTO.getAciklama() != null && !updateDTO.getAciklama().trim().isEmpty() 
                ? updateDTO.getAciklama().trim() : null);
            
            konu.setKonuAnlatimVideosuUrl(updateDTO.getKonuAnlatimVideosuUrl() != null && !updateDTO.getKonuAnlatimVideosuUrl().trim().isEmpty() 
                ? updateDTO.getKonuAnlatimVideosuUrl().trim() : null);
            
            konu.setDokumanUrl(updateDTO.getDokumanUrl() != null && !updateDTO.getDokumanUrl().trim().isEmpty() 
                ? updateDTO.getDokumanUrl().trim() : null);
            
            return konuRepository.save(konu);
        }
        
        public void deleteKonu(Long konuId) {
            Konu konu = konuRepository.findById(konuId)
                .orElseThrow(() -> new ResourceNotFoundException("Konu bulunamadı: " + konuId));
            
            // Konuya bağlı soru var mı kontrol et
            long soruCount = soruRepository.countByKonularId(konuId);
            if (soruCount > 0) {
                throw new ConflictException("Bu konuya bağlı " + soruCount + " soru bulunmaktadır. Önce soruları silin veya başka konuya taşıyın.");
            }
            
            konuRepository.delete(konu);
        }
    }
    ```

    ### KonuController

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
            
            Konu updatedKonu = konuService.updateKonu(konuId, updateDTO);
            return ResponseEntity.ok(updatedKonu);
        }
        
        @DeleteMapping("/{konuId}")
        public ResponseEntity<Map<String, String>> deleteKonu(@PathVariable Long konuId) {
            konuService.deleteKonu(konuId);
            return ResponseEntity.ok(Map.of("message", "Konu başarıyla silindi"));
        }
    }
    ```

    ## Python/Flask Örnek Implementasyon

    ```python
    from flask import Blueprint, request, jsonify
    from flask_jwt_extended import jwt_required, get_jwt_identity
    from models import Konu, Soru, db
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
        
        if 'ad' in data and data['ad']:
            konu.ad = data['ad'].strip()
        
        konu.aciklama = data.get('aciklama', '').strip() or None
        konu.konu_anlatim_videosu_url = data.get('konuAnlatimVideosuUrl', '').strip() or None
        konu.dokuman_url = data.get('dokumanUrl', '').strip() or None
        
        db.session.commit()
        return jsonify(konu.to_dict()), 200

    @konu_bp.route('/api/konu/<int:konu_id>', methods=['DELETE'])
    @admin_required
    def delete_konu(konu_id):
        konu = Konu.query.get_or_404(konu_id)
        
        # Konuya bağlı soru var mı kontrol et
        soru_count = Soru.query.filter(Soru.konular.any(id=konu_id)).count()
        if soru_count > 0:
            return jsonify({
                'error': f'Bu konuya bağlı {soru_count} soru bulunmaktadır. Önce soruları silin veya başka konuya taşıyın.'
            }), 409
        
        db.session.delete(konu)
        db.session.commit()
        return jsonify({'message': 'Konu başarıyla silindi'}), 200
    ```

    ## Node.js/Express Örnek Implementasyon

    ```javascript
    const express = require('express');
    const router = express.Router();
    const { authenticateAdmin } = require('../middleware/auth');
    const { Konu, Soru } = require('../models');

    // Konu Güncelleme
    router.put('/api/konu/:konuId', authenticateAdmin, async (req, res) => {
    try {
        const { konuId } = req.params;
        const { ad, aciklama, konuAnlatimVideosuUrl, dokumanUrl } = req.body;
        
        const konu = await Konu.findByPk(konuId);
        if (!konu) {
        return res.status(404).json({ error: 'Konu bulunamadı' });
        }
        
        if (ad) konu.ad = ad.trim();
        konu.aciklama = aciklama?.trim() || null;
        konu.konuAnlatimVideosuUrl = konuAnlatimVideosuUrl?.trim() || null;
        konu.dokumanUrl = dokumanUrl?.trim() || null;
        
        await konu.save();
        res.json(konu);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
    });

    // Konu Silme
    router.delete('/api/konu/:konuId', authenticateAdmin, async (req, res) => {
    try {
        const { konuId } = req.params;
        
        const konu = await Konu.findByPk(konuId);
        if (!konu) {
        return res.status(404).json({ error: 'Konu bulunamadı' });
        }
        
        // Konuya bağlı soru var mı kontrol et
        const soruCount = await Soru.count({
        include: [{
            model: Konu,
            where: { id: konuId }
        }]
        });
        
        if (soruCount > 0) {
        return res.status(409).json({
            error: `Bu konuya bağlı ${soruCount} soru bulunmaktadır. Önce soruları silin veya başka konuya taşıyın.`
        });
        }
        
        await konu.destroy();
        res.json({ message: 'Konu başarıyla silindi' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
    });

    module.exports = router;
    ```

    ## Database Migration (PostgreSQL)

    Eğer `aciklama` kolonu yoksa:

    ```sql
    ALTER TABLE "konu" 
    ADD COLUMN IF NOT EXISTS "aciklama" TEXT;
    ```

    ## Test Senaryoları

    ### Senaryo 1: Konu Güncelleme (Başarılı)

    ```bash
    curl -X PUT http://localhost:8080/api/konu/1 \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
    -d '{
        "ad": "Güncellenmiş Konu Adı",
        "aciklama": "Yeni açıklama",
        "konuAnlatimVideosuUrl": "https://www.youtube.com/watch?v=abc123",
        "dokumanUrl": "/files/document.pdf"
    }'
    ```

    **Beklenen Sonuç:** 200 OK, güncellenmiş konu bilgileri

    ### Senaryo 2: Konu Güncelleme (Sadece Ad)

    ```bash
    curl -X PUT http://localhost:8080/api/konu/1 \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
    -d '{
        "ad": "Sadece Ad Güncellendi"
    }'
    ```

    **Beklenen Sonuç:** 200 OK, sadece ad güncellenmiş konu

    ### Senaryo 3: Konu Silme (Başarılı - Soru Yok)

    ```bash
    curl -X DELETE http://localhost:8080/api/konu/1 \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
    ```

    **Beklenen Sonuç:** 200 OK, "Konu başarıyla silindi" mesajı

    ### Senaryo 4: Konu Silme (Hata - Soru Var)

    ```bash
    curl -X DELETE http://localhost:8080/api/konu/1 \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
    ```

    **Beklenen Sonuç:** 409 Conflict, "Bu konuya bağlı X soru bulunmaktadır" mesajı

    ### Senaryo 5: Konu Güncelleme (Konu Bulunamadı)

    ```bash
    curl -X PUT http://localhost:8080/api/konu/99999 \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
    -d '{"ad": "Test"}'
    ```

    **Beklenen Sonuç:** 404 Not Found

    ## Frontend Entegrasyonu

    Frontend'de şu endpoint'ler kullanılıyor:

    1. **Konu Güncelleme:** `PUT /api/konu/{konuId}`
    - Request body: `{ ad, aciklama, konuAnlatimVideosuUrl, dokumanUrl }`
    - Response: Güncellenmiş konu objesi

    2. **Konu Silme:** `DELETE /api/konu/{konuId}`
    - Response: `{ message: "Konu başarıyla silindi" }`

    ## Notlar

    1. **Video URL Formatı:** 
    - YouTube linki: `https://www.youtube.com/watch?v=...`
    - Dosya yolu: `/files/video.mp4`

    2. **Döküman URL Formatı:**
    - Dosya yolu: `/files/document.pdf`

    3. **Açıklama Alanı:** Opsiyonel, boş bırakılabilir

    4. **Güvenlik:** Tüm endpoint'ler admin yetkisi gerektirir

    5. **Silme İşlemi:** Konuya bağlı soru varsa silme işlemi yapılamaz (409 Conflict)


