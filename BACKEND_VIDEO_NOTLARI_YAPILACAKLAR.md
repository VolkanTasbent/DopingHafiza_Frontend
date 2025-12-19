# Backend Video Notları - Yapılacaklar Listesi

## 🔴 ACİL: Notlar Eklenmiyor Sorunu

Frontend'den gönderilen notlar backend'de kaydedilmiyor veya doğru filtrelenmiyor. Aşağıdaki adımları sırayla uygulayın.

---

## 1. Database Schema Değişikliği

### SQL Migration Script

```sql
-- video_notes tablosuna video_id kolonu ekle
ALTER TABLE video_notes 
ADD COLUMN video_id VARCHAR(255) NULL;

-- Index ekle (performans için)
CREATE INDEX idx_video_notes_konu_video_user 
ON video_notes(konu_id, video_id, user_id);

-- Mevcut kayıtlar için video_id oluştur (opsiyonel - eski notlar için)
-- Eğer video_url'den video_id oluşturmak isterseniz:
UPDATE video_notes 
SET video_id = CONCAT(konu_id, '_', MD5(video_url))
WHERE video_id IS NULL AND video_url IS NOT NULL;
```

**ÖNEMLİ:** Migration'ı çalıştırdıktan sonra backend'i yeniden başlatın.

---

## 2. Entity/DTO Güncellemesi

### VideoNote Entity (Java Spring Boot)

```java
@Entity
@Table(name = "video_notes")
public class VideoNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "konu_id", nullable = false)
    private Long konuId;
    
    @Column(name = "video_id", nullable = true) // YENİ: NULL olabilir (geriye dönük uyumluluk)
    private String videoId;
    
    @Column(name = "video_url", nullable = true)
    private String videoUrl;
    
    @Column(name = "note_text", columnDefinition = "TEXT", nullable = false)
    private String noteText;
    
    @Column(name = "timestamp_seconds", nullable = false)
    private Integer timestampSeconds;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    // Constructors, getters, setters...
}
```

### VideoNoteDTO

```java
public class VideoNoteDTO {
    private Long id;
    private Long konuId;
    private String videoId; // YENİ
    private String videoUrl;
    private String noteText;
    private Integer timestampSeconds;
    private String timestampFormatted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // getters, setters...
}
```

### VideoNoteCreateDTO

```java
public class VideoNoteCreateDTO {
    private Long konuId;
    private String videoId; // YENİ: Opsiyonel (frontend'den gelecek)
    private String videoUrl;
    private String noteText;
    private Integer timestampSeconds;
    
    // getters, setters...
}
```

---

## 3. Repository Güncellemesi

### VideoNoteRepository

```java
public interface VideoNoteRepository extends JpaRepository<VideoNote, Long> {
    
    // YENİ: videoId'ye göre filtrele
    @Query("SELECT n FROM VideoNote n WHERE n.konuId = :konuId AND n.videoId = :videoId AND n.userId = :userId ORDER BY n.timestampSeconds ASC")
    List<VideoNote> findByKonuIdAndVideoIdAndUserId(
        @Param("konuId") Long konuId,
        @Param("videoId") String videoId,
        @Param("userId") Long userId
    );
    
    // videoUrl'e göre filtrele (geriye dönük uyumluluk)
    @Query("SELECT n FROM VideoNote n WHERE n.konuId = :konuId AND n.videoUrl = :videoUrl AND n.userId = :userId ORDER BY n.timestampSeconds ASC")
    List<VideoNote> findByKonuIdAndVideoUrlAndUserId(
        @Param("konuId") Long konuId,
        @Param("videoUrl") String videoUrl,
        @Param("userId") Long userId
    );
    
    // Sadece konuId'ye göre filtrele (tüm videolar - fallback)
    @Query("SELECT n FROM VideoNote n WHERE n.konuId = :konuId AND n.userId = :userId ORDER BY n.timestampSeconds ASC")
    List<VideoNote> findByKonuIdAndUserId(
        @Param("konuId") Long konuId,
        @Param("userId") Long userId
    );
}
```

---

## 4. Service Güncellemesi

### VideoNoteService

```java
@Service
public class VideoNoteService {
    
    @Autowired
    private VideoNoteRepository videoNoteRepository;
    
    // Notları yükle
    public List<VideoNoteDTO> getVideoNotes(Long konuId, String videoId, String videoUrl, Long userId) {
        List<VideoNote> notes;
        
        if (videoId != null && !videoId.isEmpty() && !videoId.equals(videoUrl)) {
            // videoId varsa ve videoUrl'den farklıysa, videoId'ye göre filtrele
            notes = videoNoteRepository.findByKonuIdAndVideoIdAndUserId(konuId, videoId, userId);
        } else if (videoUrl != null && !videoUrl.isEmpty()) {
            // videoId yoksa ama videoUrl varsa, videoUrl'e göre filtrele (geriye dönük uyumluluk)
            notes = videoNoteRepository.findByKonuIdAndVideoUrlAndUserId(konuId, videoUrl, userId);
        } else {
            // Hiçbiri yoksa, sadece konuId'ye göre filtrele (tüm videolar)
            notes = videoNoteRepository.findByKonuIdAndUserId(konuId, userId);
        }
        
        return notes.stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
    }
    
    // Not ekle
    public VideoNoteDTO createVideoNote(VideoNoteCreateDTO dto, Long userId) {
        VideoNote note = new VideoNote();
        note.setKonuId(dto.getKonuId());
        
        // videoId varsa ve videoUrl'den farklıysa kaydet
        if (dto.getVideoId() != null && !dto.getVideoId().isEmpty() && !dto.getVideoId().equals(dto.getVideoUrl())) {
            note.setVideoId(dto.getVideoId());
        }
        
        note.setVideoUrl(dto.getVideoUrl());
        note.setNoteText(dto.getNoteText());
        note.setTimestampSeconds(dto.getTimestampSeconds());
        note.setUserId(userId);
        note.setCreatedAt(LocalDateTime.now());
        note.setUpdatedAt(LocalDateTime.now());
        
        VideoNote saved = videoNoteRepository.save(note);
        return toDTO(saved);
    }
    
    // Not güncelle
    public VideoNoteDTO updateVideoNote(Long noteId, String noteText, Long userId) {
        VideoNote note = videoNoteRepository.findById(noteId)
            .orElseThrow(() -> new RuntimeException("Not bulunamadı"));
        
        if (!note.getUserId().equals(userId)) {
            throw new RuntimeException("Bu not size ait değil");
        }
        
        note.setNoteText(noteText);
        note.setUpdatedAt(LocalDateTime.now());
        
        VideoNote updated = videoNoteRepository.save(note);
        return toDTO(updated);
    }
    
    // Not sil
    public void deleteVideoNote(Long noteId, Long userId) {
        VideoNote note = videoNoteRepository.findById(noteId)
            .orElseThrow(() -> new RuntimeException("Not bulunamadı"));
        
        if (!note.getUserId().equals(userId)) {
            throw new RuntimeException("Bu not size ait değil");
        }
        
        videoNoteRepository.delete(note);
    }
    
    // Entity'yi DTO'ya çevir
    private VideoNoteDTO toDTO(VideoNote note) {
        VideoNoteDTO dto = new VideoNoteDTO();
        dto.setId(note.getId());
        dto.setKonuId(note.getKonuId());
        dto.setVideoId(note.getVideoId());
        dto.setVideoUrl(note.getVideoUrl());
        dto.setNoteText(note.getNoteText());
        dto.setTimestampSeconds(note.getTimestampSeconds());
        dto.setTimestampFormatted(formatTimestamp(note.getTimestampSeconds()));
        dto.setCreatedAt(note.getCreatedAt());
        dto.setUpdatedAt(note.getUpdatedAt());
        return dto;
    }
    
    private String formatTimestamp(int seconds) {
        int hours = seconds / 3600;
        int minutes = (seconds % 3600) / 60;
        int secs = seconds % 60;
        
        if (hours > 0) {
            return String.format("%d:%02d:%02d", hours, minutes, secs);
        }
        return String.format("%d:%02d", minutes, secs);
    }
}
```

---

## 5. Controller Güncellemesi

### VideoNoteController

```java
@RestController
@RequestMapping("/api/video-notes")
public class VideoNoteController {
    
    @Autowired
    private VideoNoteService videoNoteService;
    
    // Kullanıcı ID'sini al (JWT token'dan veya session'dan)
    private Long getCurrentUserId() {
        // TODO: Authentication'dan kullanıcı ID'sini al
        // Örnek: return SecurityContextHolder.getContext().getAuthentication().getPrincipal().getId();
        return 1L; // Geçici - gerçek implementasyonu ekleyin
    }
    
    // Notları yükle
    @GetMapping
    public ResponseEntity<Map<String, Object>> getVideoNotes(
        @RequestParam Long konuId,
        @RequestParam(required = false) String videoId,
        @RequestParam(required = false) String videoUrl
    ) {
        try {
            Long userId = getCurrentUserId();
            List<VideoNoteDTO> notes = videoNoteService.getVideoNotes(konuId, videoId, videoUrl, userId);
            
            return ResponseEntity.ok(Map.of("notes", notes));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                .body(Map.of("error", "Notlar yüklenemedi: " + e.getMessage()));
        }
    }
    
    // Not ekle
    @PostMapping
    public ResponseEntity<?> createVideoNote(@RequestBody VideoNoteCreateDTO dto) {
        try {
            Long userId = getCurrentUserId();
            
            // Validasyon
            if (dto.getKonuId() == null) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "konuId gerekli"));
            }
            if (dto.getNoteText() == null || dto.getNoteText().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "noteText gerekli"));
            }
            if (dto.getTimestampSeconds() == null) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "timestampSeconds gerekli"));
            }
            
            VideoNoteDTO created = videoNoteService.createVideoNote(dto, userId);
            return ResponseEntity.ok(created);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                .body(Map.of("error", "Not kaydedilemedi: " + e.getMessage()));
        }
    }
    
    // Not güncelle
    @PutMapping("/{noteId}")
    public ResponseEntity<?> updateVideoNote(
        @PathVariable Long noteId,
        @RequestBody Map<String, String> request
    ) {
        try {
            Long userId = getCurrentUserId();
            String noteText = request.get("noteText");
            
            if (noteText == null || noteText.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "noteText gerekli"));
            }
            
            VideoNoteDTO updated = videoNoteService.updateVideoNote(noteId, noteText, userId);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                .body(Map.of("error", "Not güncellenemedi: " + e.getMessage()));
        }
    }
    
    // Not sil
    @DeleteMapping("/{noteId}")
    public ResponseEntity<?> deleteVideoNote(@PathVariable Long noteId) {
        try {
            Long userId = getCurrentUserId();
            videoNoteService.deleteVideoNote(noteId, userId);
            return ResponseEntity.ok(Map.of("message", "Not silindi"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                .body(Map.of("error", "Not silinemedi: " + e.getMessage()));
        }
    }
}
```

---

## 6. Frontend'den Gelen Request Formatı

### POST /api/video-notes Request Body

```json
{
  "konuId": 123,
  "videoId": "123_0",  // Opsiyonel: Birden fazla video varsa "konuId_videoIndex" formatında
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "noteText": "Bu önemli bir not",
  "timestampSeconds": 120
}
```

**ÖNEMLİ:** 
- `videoId` opsiyoneldir
- Eğer `videoId` yoksa veya `videoUrl` ile aynıysa, sadece `videoUrl` kullanılır
- `videoId` formatı: `"konuId_videoIndex"` (örn: "123_0", "123_1")

### GET /api/video-notes Query Parameters

```
GET /api/video-notes?konuId=123&videoId=123_0&videoUrl=https://...
```

**ÖNEMLİ:**
- `videoId` varsa, sadece o `videoId`'ye ait notlar döndürülür
- `videoId` yoksa ama `videoUrl` varsa, `videoUrl`'e göre filtreleme yapılır
- İkisi de yoksa, sadece `konuId`'ye göre filtreleme yapılır (tüm videolar)

---

## 7. Test Senaryoları

### Test 1: Not Ekleme (videoId ile)

```bash
curl -X POST http://localhost:8080/api/video-notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "konuId": 123,
    "videoId": "123_0",
    "videoUrl": "https://www.youtube.com/watch?v=abc123",
    "noteText": "Test notu",
    "timestampSeconds": 60
  }'
```

**Beklenen:** Not kaydedilmeli ve `videoId: "123_0"` ile dönmeli

### Test 2: Notları Yükleme (videoId ile)

```bash
curl -X GET "http://localhost:8080/api/video-notes?konuId=123&videoId=123_0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Beklenen:** Sadece `videoId: "123_0"` olan notlar dönmeli

### Test 3: Notları Yükleme (videoUrl ile - geriye dönük uyumluluk)

```bash
curl -X GET "http://localhost:8080/api/video-notes?konuId=123&videoUrl=https://www.youtube.com/watch?v=abc123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Beklenen:** Sadece `videoUrl` eşleşen notlar dönmeli

---

## 8. Hata Ayıklama (Debugging)

### Console Log'ları Ekleyin

```java
@PostMapping
public ResponseEntity<?> createVideoNote(@RequestBody VideoNoteCreateDTO dto) {
    System.out.println("=== NOT EKLEME İSTEĞİ ===");
    System.out.println("konuId: " + dto.getKonuId());
    System.out.println("videoId: " + dto.getVideoId());
    System.out.println("videoUrl: " + dto.getVideoUrl());
    System.out.println("noteText: " + dto.getNoteText());
    System.out.println("timestampSeconds: " + dto.getTimestampSeconds());
    
    try {
        Long userId = getCurrentUserId();
        System.out.println("userId: " + userId);
        
        VideoNoteDTO created = videoNoteService.createVideoNote(dto, userId);
        System.out.println("Not kaydedildi: " + created.getId());
        
        return ResponseEntity.ok(created);
    } catch (Exception e) {
        e.printStackTrace();
        return ResponseEntity.status(500)
            .body(Map.of("error", "Not kaydedilemedi: " + e.getMessage()));
    }
}
```

### Database Kontrolü

```sql
-- Tüm notları kontrol et
SELECT * FROM video_notes ORDER BY created_at DESC LIMIT 10;

-- video_id kolonunu kontrol et
SELECT id, konu_id, video_id, video_url, note_text, user_id 
FROM video_notes 
WHERE konu_id = 123;
```

---

## 9. Önemli Notlar

1. **Geriye Dönük Uyumluluk:** Eski notlar `videoUrl`'e göre çalışmaya devam etmeli
2. **videoId Formatı:** Frontend'den `"konuId_videoIndex"` formatında geliyor (örn: "123_0")
3. **NULL Handling:** `video_id` kolonu NULL olabilir (eski notlar için)
4. **User ID:** Her not kullanıcıya özel olmalı (userId kontrolü yapın)
5. **Index:** Performans için `(konu_id, video_id, user_id)` index'i ekleyin

---

## 10. Checklist

- [ ] Database migration çalıştırıldı (`video_id` kolonu eklendi)
- [ ] Entity/DTO güncellendi (`videoId` alanı eklendi)
- [ ] Repository metodları eklendi (`findByKonuIdAndVideoIdAndUserId`)
- [ ] Service güncellendi (`getVideoNotes`, `createVideoNote`)
- [ ] Controller güncellendi (`GET` ve `POST` endpoint'leri)
- [ ] Test edildi (not ekleme ve yükleme)
- [ ] Console log'ları eklendi (debugging için)
- [ ] Database'de notlar görünüyor mu kontrol edildi

---

## Sorun Giderme

### Notlar eklenmiyor
1. Database'de `video_id` kolonu var mı kontrol edin
2. Backend log'larını kontrol edin (hata mesajları)
3. Frontend'den gönderilen request body'yi kontrol edin (Network tab)
4. `userId` doğru alınıyor mu kontrol edin

### Notlar yüklenmiyor
1. Repository metodları doğru çalışıyor mu kontrol edin
2. Query parametreleri doğru geliyor mu kontrol edin
3. Database'de notlar var mı kontrol edin
4. `videoId` ve `videoUrl` filtrelemesi doğru çalışıyor mu kontrol edin


