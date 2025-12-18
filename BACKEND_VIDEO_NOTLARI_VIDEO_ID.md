# Backend Video Notları - Video ID Desteği

## Sorun
Frontend'de birden fazla video olan konularda, bir videoya eklenen notlar tüm videolarda görünüyor. Her video için ayrı notlar tutulması gerekiyor.

## Çözüm

### 1. Database Schema Değişikliği

`video_notes` tablosuna `video_id` kolonu eklenmelidir:

```sql
ALTER TABLE video_notes 
ADD COLUMN video_id VARCHAR(255) NULL;

-- Mevcut kayıtlar için videoUrl'den video_id oluştur (opsiyonel)
UPDATE video_notes 
SET video_id = MD5(video_url) 
WHERE video_id IS NULL;
```

**Alternatif:** Eğer `video_id` kolonu zaten varsa, `video_id` ve `video_url` birlikte kullanılabilir.

### 2. VideoNote Entity/DTO Güncellemesi

**Java Spring Boot Örneği:**

```java
@Entity
@Table(name = "video_notes")
public class VideoNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "konu_id")
    private Long konuId;
    
    @Column(name = "video_id")
    private String videoId; // YENİ: Video ID (örn: "konuId_videoIndex" veya backend'den gelen video ID)
    
    @Column(name = "video_url")
    private String videoUrl;
    
    @Column(name = "note_text", columnDefinition = "TEXT")
    private String noteText;
    
    @Column(name = "timestamp_seconds")
    private Integer timestampSeconds;
    
    @Column(name = "user_id")
    private Long userId;
    
    // ... getter/setter'lar
}
```

**DTO:**

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
    
    // ... getter/setter'lar
}
```

### 3. VideoNoteService Güncellemesi

**Notları yükleme (GET /api/video-notes):**

```java
@GetMapping("/api/video-notes")
public ResponseEntity<Map<String, Object>> getVideoNotes(
    @RequestParam Long konuId,
    @RequestParam(required = false) String videoId, // YENİ: Opsiyonel
    @RequestParam(required = false) String videoUrl // Opsiyonel (geriye dönük uyumluluk)
) {
    try {
        Long userId = getCurrentUserId(); // Kullanıcı ID'sini al
        
        List<VideoNote> notes;
        
        if (videoId != null && !videoId.isEmpty()) {
            // videoId varsa, videoId'ye göre filtrele
            notes = videoNoteRepository.findByKonuIdAndVideoIdAndUserId(
                konuId, videoId, userId
            );
        } else if (videoUrl != null && !videoUrl.isEmpty()) {
            // videoId yoksa ama videoUrl varsa, videoUrl'e göre filtrele (geriye dönük uyumluluk)
            notes = videoNoteRepository.findByKonuIdAndVideoUrlAndUserId(
                konuId, videoUrl, userId
            );
        } else {
            // Hiçbiri yoksa, sadece konuId'ye göre filtrele (tüm videolar)
            notes = videoNoteRepository.findByKonuIdAndUserId(konuId, userId);
        }
        
        List<VideoNoteDTO> noteDTOs = notes.stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
        
        return ResponseEntity.ok(Map.of("notes", noteDTOs));
    } catch (Exception e) {
        return ResponseEntity.status(500)
            .body(Map.of("error", "Notlar yüklenemedi: " + e.getMessage()));
    }
}
```

**Not ekleme (POST /api/video-notes):**

```java
@PostMapping("/api/video-notes")
public ResponseEntity<VideoNoteDTO> createVideoNote(@RequestBody VideoNoteCreateDTO dto) {
    try {
        Long userId = getCurrentUserId();
        
        VideoNote note = new VideoNote();
        note.setKonuId(dto.getKonuId());
        note.setVideoId(dto.getVideoId()); // YENİ: videoId kaydet
        note.setVideoUrl(dto.getVideoUrl());
        note.setNoteText(dto.getNoteText());
        note.setTimestampSeconds(dto.getTimestampSeconds());
        note.setUserId(userId);
        note.setCreatedAt(LocalDateTime.now());
        note.setUpdatedAt(LocalDateTime.now());
        
        VideoNote saved = videoNoteRepository.save(note);
        
        return ResponseEntity.ok(toDTO(saved));
    } catch (Exception e) {
        return ResponseEntity.status(500)
            .body(null);
    }
}
```

**VideoNoteCreateDTO:**

```java
public class VideoNoteCreateDTO {
    private Long konuId;
    private String videoId; // YENİ: Opsiyonel (frontend'den gelecek)
    private String videoUrl;
    private String noteText;
    private Integer timestampSeconds;
    
    // ... getter/setter'lar
}
```

### 4. Repository Metodları

```java
public interface VideoNoteRepository extends JpaRepository<VideoNote, Long> {
    // videoId'ye göre filtrele
    List<VideoNote> findByKonuIdAndVideoIdAndUserId(
        Long konuId, String videoId, Long userId
    );
    
    // videoUrl'e göre filtrele (geriye dönük uyumluluk)
    List<VideoNote> findByKonuIdAndVideoUrlAndUserId(
        Long konuId, String videoUrl, Long userId
    );
    
    // Sadece konuId'ye göre filtrele
    List<VideoNote> findByKonuIdAndUserId(Long konuId, Long userId);
}
```

### 5. Python/Flask Örneği

```python
from flask import request, jsonify
from models import VideoNote, db

@app.route('/api/video-notes', methods=['GET'])
def get_video_notes():
    konu_id = request.args.get('konuId', type=int)
    video_id = request.args.get('videoId')  # YENİ
    video_url = request.args.get('videoUrl')
    user_id = get_current_user_id()
    
    query = VideoNote.query.filter_by(konu_id=konu_id, user_id=user_id)
    
    if video_id:
        # videoId varsa, videoId'ye göre filtrele
        query = query.filter_by(video_id=video_id)
    elif video_url:
        # videoId yoksa ama videoUrl varsa, videoUrl'e göre filtrele
        query = query.filter_by(video_url=video_url)
    # Hiçbiri yoksa, sadece konuId'ye göre filtrele
    
    notes = query.all()
    
    return jsonify({
        'notes': [note.to_dict() for note in notes]
    })

@app.route('/api/video-notes', methods=['POST'])
def create_video_note():
    data = request.json
    user_id = get_current_user_id()
    
    note = VideoNote(
        konu_id=data['konuId'],
        video_id=data.get('videoId'),  # YENİ: Opsiyonel
        video_url=data['videoUrl'],
        note_text=data['noteText'],
        timestamp_seconds=data['timestampSeconds'],
        user_id=user_id
    )
    
    db.session.add(note)
    db.session.commit()
    
    return jsonify(note.to_dict())
```

### 6. Node.js/Express Örneği

```javascript
// GET /api/video-notes
app.get('/api/video-notes', async (req, res) => {
  try {
    const { konuId, videoId, videoUrl } = req.query;
    const userId = req.user.id;
    
    let query = { konuId, userId };
    
    if (videoId) {
      // videoId varsa, videoId'ye göre filtrele
      query.videoId = videoId;
    } else if (videoUrl) {
      // videoId yoksa ama videoUrl varsa, videoUrl'e göre filtrele
      query.videoUrl = videoUrl;
    }
    // Hiçbiri yoksa, sadece konuId'ye göre filtrele
    
    const notes = await VideoNote.find(query);
    
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
      videoId, // YENİ: Opsiyonel
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

## Önemli Notlar

1. **Geriye Dönük Uyumluluk:** Eğer `videoId` yoksa, `videoUrl` kullanılmalı (eski notlar için).

2. **Frontend'den Gelen videoId Formatı:**
   - Birden fazla video varsa: `"konuId_videoIndex"` (örn: "123_0", "123_1")
   - Tek video varsa: `konuId` (geriye dönük uyumluluk)

3. **Database Index:**
   ```sql
   CREATE INDEX idx_video_notes_konu_video ON video_notes(konu_id, video_id, user_id);
   ```

4. **Migration Script:**
   ```sql
   -- Mevcut notlar için videoId oluştur (opsiyonel)
   UPDATE video_notes 
   SET video_id = CONCAT(konu_id, '_', MD5(video_url))
   WHERE video_id IS NULL;
   ```

## Test Senaryoları

1. **Birden fazla video olan konu:**
   - Video 1'e not ekle → Sadece Video 1'de görünmeli
   - Video 2'ye not ekle → Sadece Video 2'de görünmeli

2. **Tek video olan konu (geriye dönük uyumluluk):**
   - Not ekle → videoId yoksa videoUrl'e göre çalışmalı

3. **Mevcut notlar:**
   - Eski notlar videoUrl'e göre görünmeye devam etmeli

