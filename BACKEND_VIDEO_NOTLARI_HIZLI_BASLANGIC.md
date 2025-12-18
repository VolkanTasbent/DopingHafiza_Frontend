# Backend Video Notları - Hızlı Başlangıç Kılavuzu

## 🎯 Özet

Frontend'den gelen video notları artık `videoId` ile ayrılıyor. Her video için ayrı notlar tutulması gerekiyor.

---

## 1. Database Migration (İLK ADIM)

```sql
-- video_notes tablosuna video_id kolonu ekle
ALTER TABLE video_notes 
ADD COLUMN video_id VARCHAR(255) NULL;

-- Index ekle (performans için)
CREATE INDEX idx_video_notes_konu_video_user 
ON video_notes(konu_id, video_id, user_id);
```

**⚠️ ÖNEMLİ:** Migration'ı çalıştırdıktan sonra backend'i yeniden başlatın.

---

## 2. Frontend'den Gelen Request Formatı

### POST /api/video-notes

```json
{
  "konuId": 123,
  "videoId": "123_0",           // Opsiyonel: "konuId_videoIndex" formatında
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "noteText": "Bu önemli bir not",
  "timestampSeconds": 120
}
```

**ÖNEMLİ:**
- `videoId` **opsiyoneldir** (undefined olabilir)
- Eğer `videoId` yoksa veya `videoUrl` ile aynıysa, sadece `videoUrl` kullanılır
- `videoId` formatı: `"konuId_videoIndex"` (örn: "123_0", "123_1", "123_2")

### GET /api/video-notes

```
GET /api/video-notes?konuId=123&videoId=123_0&videoUrl=https://...
```

**ÖNEMLİ:**
- `videoId` varsa → Sadece o `videoId`'ye ait notlar döndürülür
- `videoId` yoksa ama `videoUrl` varsa → `videoUrl`'e göre filtreleme yapılır
- İkisi de yoksa → Sadece `konuId`'ye göre filtreleme yapılır (tüm videolar)

---

## 3. Java Spring Boot - Hızlı Implementasyon

### Entity Güncellemesi

```java
@Entity
@Table(name = "video_notes")
public class VideoNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "konu_id", nullable = false)
    private Long konuId;
    
    @Column(name = "video_id", nullable = true) // YENİ: NULL olabilir
    private String videoId;
    
    @Column(name = "video_url", nullable = true)
    private String videoUrl;
    
    @Column(name = "note_text", columnDefinition = "TEXT", nullable = false)
    private String noteText;
    
    @Column(name = "timestamp_seconds", nullable = false)
    private Integer timestampSeconds;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    // ... getters, setters, constructors
}
```

### Repository

```java
public interface VideoNoteRepository extends JpaRepository<VideoNote, Long> {
    
    // videoId'ye göre filtrele
    List<VideoNote> findByKonuIdAndVideoIdAndUserIdOrderByTimestampSecondsAsc(
        Long konuId, String videoId, Long userId
    );
    
    // videoUrl'e göre filtrele (geriye dönük uyumluluk)
    List<VideoNote> findByKonuIdAndVideoUrlAndUserIdOrderByTimestampSecondsAsc(
        Long konuId, String videoUrl, Long userId
    );
    
    // Sadece konuId'ye göre filtrele
    List<VideoNote> findByKonuIdAndUserIdOrderByTimestampSecondsAsc(
        Long konuId, Long userId
    );
}
```

### Service

```java
@Service
public class VideoNoteService {
    
    @Autowired
    private VideoNoteRepository repository;
    
    public List<VideoNote> getVideoNotes(Long konuId, String videoId, String videoUrl, Long userId) {
        if (videoId != null && !videoId.isEmpty() && !videoId.equals(videoUrl)) {
            // videoId varsa ve videoUrl'den farklıysa
            return repository.findByKonuIdAndVideoIdAndUserIdOrderByTimestampSecondsAsc(
                konuId, videoId, userId
            );
        } else if (videoUrl != null && !videoUrl.isEmpty()) {
            // videoId yoksa ama videoUrl varsa
            return repository.findByKonuIdAndVideoUrlAndUserIdOrderByTimestampSecondsAsc(
                konuId, videoUrl, userId
            );
        } else {
            // Hiçbiri yoksa, sadece konuId
            return repository.findByKonuIdAndUserIdOrderByTimestampSecondsAsc(konuId, userId);
        }
    }
    
    public VideoNote createVideoNote(VideoNoteCreateDTO dto, Long userId) {
        VideoNote note = new VideoNote();
        note.setKonuId(dto.getKonuId());
        
        // videoId varsa ve videoUrl'den farklıysa kaydet
        if (dto.getVideoId() != null && !dto.getVideoId().isEmpty() 
            && !dto.getVideoId().equals(dto.getVideoUrl())) {
            note.setVideoId(dto.getVideoId());
        }
        
        note.setVideoUrl(dto.getVideoUrl());
        note.setNoteText(dto.getNoteText());
        note.setTimestampSeconds(dto.getTimestampSeconds());
        note.setUserId(userId);
        note.setCreatedAt(LocalDateTime.now());
        note.setUpdatedAt(LocalDateTime.now());
        
        return repository.save(note);
    }
}
```

### Controller

```java
@RestController
@RequestMapping("/api/video-notes")
public class VideoNoteController {
    
    @Autowired
    private VideoNoteService service;
    
    private Long getCurrentUserId() {
        // TODO: JWT token'dan veya session'dan kullanıcı ID'sini al
        return 1L; // Geçici
    }
    
    @GetMapping
    public ResponseEntity<Map<String, Object>> getVideoNotes(
        @RequestParam Long konuId,
        @RequestParam(required = false) String videoId,
        @RequestParam(required = false) String videoUrl
    ) {
        try {
            Long userId = getCurrentUserId();
            List<VideoNote> notes = service.getVideoNotes(konuId, videoId, videoUrl, userId);
            
            // DTO'ya çevir
            List<VideoNoteDTO> noteDTOs = notes.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
            
            return ResponseEntity.ok(Map.of("notes", noteDTOs));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("error", e.getMessage()));
        }
    }
    
    @PostMapping
    public ResponseEntity<?> createVideoNote(@RequestBody VideoNoteCreateDTO dto) {
        try {
            Long userId = getCurrentUserId();
            
            // Validasyon
            if (dto.getKonuId() == null || dto.getNoteText() == null 
                || dto.getTimestampSeconds() == null) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "konuId, noteText ve timestampSeconds gerekli"));
            }
            
            VideoNote created = service.createVideoNote(dto, userId);
            return ResponseEntity.ok(toDTO(created));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("error", e.getMessage()));
        }
    }
    
    private VideoNoteDTO toDTO(VideoNote note) {
        VideoNoteDTO dto = new VideoNoteDTO();
        dto.setId(note.getId());
        dto.setKonuId(note.getKonuId());
        dto.setVideoId(note.getVideoId());
        dto.setVideoUrl(note.getVideoUrl());
        dto.setNoteText(note.getNoteText());
        dto.setTimestampSeconds(note.getTimestampSeconds());
        dto.setTimestampFormatted(formatTimestamp(note.getTimestampSeconds()));
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

### DTO'lar

```java
// VideoNoteCreateDTO
public class VideoNoteCreateDTO {
    private Long konuId;
    private String videoId;      // Opsiyonel
    private String videoUrl;
    private String noteText;
    private Integer timestampSeconds;
    // getters, setters
}

// VideoNoteDTO
public class VideoNoteDTO {
    private Long id;
    private Long konuId;
    private String videoId;      // Opsiyonel
    private String videoUrl;
    private String noteText;
    private Integer timestampSeconds;
    private String timestampFormatted;
    // getters, setters
}
```

---

## 4. Python/Flask - Hızlı Implementasyon

### Model

```python
class VideoNote(db.Model):
    __tablename__ = 'video_notes'
    
    id = db.Column(db.Integer, primary_key=True)
    konu_id = db.Column(db.Integer, nullable=False)
    video_id = db.Column(db.String(255), nullable=True)  # YENİ
    video_url = db.Column(db.String(500), nullable=True)
    note_text = db.Column(db.Text, nullable=False)
    timestamp_seconds = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Routes

```python
@app.route('/api/video-notes', methods=['GET'])
def get_video_notes():
    konu_id = request.args.get('konuId', type=int)
    video_id = request.args.get('videoId')  # Opsiyonel
    video_url = request.args.get('videoUrl')
    user_id = get_current_user_id()
    
    query = VideoNote.query.filter_by(konu_id=konu_id, user_id=user_id)
    
    if video_id and video_id != video_url:
        query = query.filter_by(video_id=video_id)
    elif video_url:
        query = query.filter_by(video_url=video_url)
    
    notes = query.order_by(VideoNote.timestamp_seconds).all()
    
    return jsonify({
        'notes': [note.to_dict() for note in notes]
    })

@app.route('/api/video-notes', methods=['POST'])
def create_video_note():
    data = request.json
    user_id = get_current_user_id()
    
    note = VideoNote(
        konu_id=data['konuId'],
        video_id=data.get('videoId') if data.get('videoId') != data.get('videoUrl') else None,
        video_url=data['videoUrl'],
        note_text=data['noteText'],
        timestamp_seconds=data['timestampSeconds'],
        user_id=user_id
    )
    
    db.session.add(note)
    db.session.commit()
    
    return jsonify(note.to_dict())
```

---

## 5. Node.js/Express - Hızlı Implementasyon

### Model (Mongoose)

```javascript
const videoNoteSchema = new mongoose.Schema({
  konuId: { type: Number, required: true },
  videoId: { type: String, required: false }, // YENİ: Opsiyonel
  videoUrl: { type: String, required: false },
  noteText: { type: String, required: true },
  timestampSeconds: { type: Number, required: true },
  userId: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
```

### Routes

```javascript
// GET /api/video-notes
app.get('/api/video-notes', async (req, res) => {
  try {
    const { konuId, videoId, videoUrl } = req.query;
    const userId = req.user.id;
    
    let query = { konuId, userId };
    
    if (videoId && videoId !== videoUrl) {
      query.videoId = videoId;
    } else if (videoUrl) {
      query.videoUrl = videoUrl;
    }
    
    const notes = await VideoNote.find(query)
      .sort({ timestampSeconds: 1 });
    
    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/video-notes
app.post('/api/video-notes', async (req, res) => {
  try {
    const { konuId, videoId, videoUrl, noteText, timestampSeconds } = req.body;
    const userId = req.user.id;
    
    const note = new VideoNote({
      konuId,
      videoId: (videoId && videoId !== videoUrl) ? videoId : undefined,
      videoUrl,
      noteText,
      timestampSeconds,
      userId
    });
    
    await note.save();
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 6. Test Senaryoları

### Test 1: Not Ekleme (videoId ile)

```bash
curl -X POST http://localhost:8080/api/video-notes \
  -H "Content-Type: application/json" \
  -d '{
    "konuId": 123,
    "videoId": "123_0",
    "videoUrl": "https://www.youtube.com/watch?v=abc123",
    "noteText": "Test notu",
    "timestampSeconds": 60
  }'
```

**Beklenen:** Not kaydedilmeli, `videoId: "123_0"` ile dönmeli

### Test 2: Notları Yükleme (videoId ile)

```bash
curl -X GET "http://localhost:8080/api/video-notes?konuId=123&videoId=123_0"
```

**Beklenen:** Sadece `videoId: "123_0"` olan notlar dönmeli

### Test 3: Notları Yükleme (videoUrl ile - geriye dönük)

```bash
curl -X GET "http://localhost:8080/api/video-notes?konuId=123&videoUrl=https://www.youtube.com/watch?v=abc123"
```

**Beklenen:** Sadece `videoUrl` eşleşen notlar dönmeli

---

## 7. Önemli Notlar

1. **videoId Opsiyonel:** Eğer `videoId` yoksa veya `videoUrl` ile aynıysa, sadece `videoUrl` kullanılır
2. **Geriye Dönük Uyumluluk:** Eski notlar `videoUrl`'e göre çalışmaya devam eder
3. **User ID:** Her not kullanıcıya özel olmalı (userId kontrolü yapın)
4. **NULL Handling:** `video_id` kolonu NULL olabilir (eski notlar için)

---

## 8. Checklist

- [ ] Database migration çalıştırıldı (`video_id` kolonu eklendi)
- [ ] Entity/Model güncellendi (`videoId` alanı eklendi)
- [ ] Repository/Query metodları eklendi
- [ ] Service/Logic güncellendi
- [ ] Controller/Routes güncellendi
- [ ] Test edildi (not ekleme ve yükleme)
- [ ] Backend log'ları kontrol edildi

---

## 9. Hata Ayıklama

### Notlar eklenmiyor
1. Database'de `video_id` kolonu var mı kontrol edin
2. Backend log'larını kontrol edin
3. Frontend'den gönderilen request body'yi kontrol edin (Network tab)
4. `userId` doğru alınıyor mu kontrol edin

### Notlar yüklenmiyor
1. Query parametreleri doğru geliyor mu kontrol edin
2. Database'de notlar var mı kontrol edin
3. `videoId` ve `videoUrl` filtrelemesi doğru çalışıyor mu kontrol edin

---

## 10. Örnek Response Formatı

### GET /api/video-notes Response

```json
{
  "notes": [
    {
      "id": 1,
      "konuId": 123,
      "videoId": "123_0",
      "videoUrl": "https://www.youtube.com/watch?v=abc123",
      "noteText": "Bu önemli bir not",
      "timestampSeconds": 120,
      "timestampFormatted": "2:00",
      "createdAt": "2024-01-01T12:00:00",
      "updatedAt": "2024-01-01T12:00:00"
    }
  ]
}
```

### POST /api/video-notes Response

```json
{
  "id": 1,
  "konuId": 123,
  "videoId": "123_0",
  "videoUrl": "https://www.youtube.com/watch?v=abc123",
  "noteText": "Bu önemli bir not",
  "timestampSeconds": 120,
  "timestampFormatted": "2:00",
  "createdAt": "2024-01-01T12:00:00",
  "updatedAt": "2024-01-01T12:00:00"
}
```

---

**Daha detaylı bilgi için:** `BACKEND_VIDEO_NOTLARI_YAPILACAKLAR.md` dosyasına bakın.

