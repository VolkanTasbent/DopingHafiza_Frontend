# 📝 Video İçinde Not Alma - Backend Kurulum Rehberi

## 📋 Özet

Video izlerken not alma özelliği için backend'de aşağıdaki değişiklikler gereklidir.

---

## 🗄️ Database Yapısı

### 1. `video_note` Tablosu Oluştur

```sql
CREATE TABLE video_note (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    konu_id BIGINT NOT NULL REFERENCES konu(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    note_text TEXT NOT NULL,
    timestamp_seconds INTEGER NOT NULL, -- Video'daki zaman damgası (saniye)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES "user"(id),
    CONSTRAINT fk_konu FOREIGN KEY (konu_id) REFERENCES konu(id)
);

-- Index'ler
CREATE INDEX idx_video_note_user ON video_note(user_id);
CREATE INDEX idx_video_note_konu ON video_note(konu_id);
CREATE INDEX idx_video_note_user_konu ON video_note(user_id, konu_id);
```

---

## 🔌 API Endpoint'leri

### 1. Video Notu Oluştur

**Endpoint:** `POST /api/video-notes`

**Request Body:**
```json
{
  "konuId": 123,
  "videoUrl": "https://www.youtube.com/embed/abc123",
  "noteText": "Burada önemli bir formül var: E=mc²",
  "timestampSeconds": 125
}
```

**Response:**
```json
{
  "id": 456,
  "userId": 1,
  "konuId": 123,
  "videoUrl": "https://www.youtube.com/embed/abc123",
  "noteText": "Burada önemli bir formül var: E=mc²",
  "timestampSeconds": 125,
  "createdAt": "2025-01-15T14:30:00Z",
  "updatedAt": "2025-01-15T14:30:00Z"
}
```

**Controller Örneği (Java Spring Boot):**
```java
@PostMapping("/api/video-notes")
public ResponseEntity<VideoNoteResponse> createVideoNote(
    @RequestBody CreateVideoNoteRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    VideoNote note = new VideoNote();
    note.setUserId(user.getId());
    note.setKonuId(request.getKonuId());
    note.setVideoUrl(request.getVideoUrl());
    note.setNoteText(request.getNoteText());
    note.setTimestampSeconds(request.getTimestampSeconds());
    
    VideoNote saved = videoNoteRepository.save(note);
    
    return ResponseEntity.ok(VideoNoteResponse.from(saved));
}
```

---

### 2. Video Notlarını Getir

**Endpoint:** `GET /api/video-notes`

**Query Parameters:**
- `konuId` (optional): Belirli bir konu için notlar
- `videoUrl` (optional): Belirli bir video için notlar

**Response:**
```json
{
  "notes": [
    {
      "id": 456,
      "konuId": 123,
      "videoUrl": "https://www.youtube.com/embed/abc123",
      "noteText": "Burada önemli bir formül var: E=mc²",
      "timestampSeconds": 125,
      "timestampFormatted": "02:05",
      "createdAt": "2025-01-15T14:30:00Z",
      "updatedAt": "2025-01-15T14:30:00Z"
    },
    {
      "id": 457,
      "konuId": 123,
      "videoUrl": "https://www.youtube.com/embed/abc123",
      "noteText": "Bu konu sınavda çıkabilir",
      "timestampSeconds": 245,
      "timestampFormatted": "04:05",
      "createdAt": "2025-01-15T15:00:00Z",
      "updatedAt": "2025-01-15T15:00:00Z"
    }
  ]
}
```

**Controller Örneği:**
```java
@GetMapping("/api/video-notes")
public ResponseEntity<VideoNotesResponse> getVideoNotes(
    @RequestParam(required = false) Long konuId,
    @RequestParam(required = false) String videoUrl,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    List<VideoNote> notes;
    if (konuId != null) {
        notes = videoNoteRepository.findByUserIdAndKonuId(user.getId(), konuId);
    } else if (videoUrl != null) {
        notes = videoNoteRepository.findByUserIdAndVideoUrl(user.getId(), videoUrl);
    } else {
        notes = videoNoteRepository.findByUserId(user.getId());
    }
    
    // Zaman damgasına göre sırala
    notes.sort(Comparator.comparing(VideoNote::getTimestampSeconds));
    
    List<VideoNoteResponse> noteResponses = notes.stream()
        .map(VideoNoteResponse::from)
        .collect(Collectors.toList());
    
    return ResponseEntity.ok(new VideoNotesResponse(noteResponses));
}
```

---

### 3. Video Notu Güncelle

**Endpoint:** `PUT /api/video-notes/:id`

**Request Body:**
```json
{
  "noteText": "Güncellenmiş not metni",
  "timestampSeconds": 130
}
```

**Response:**
```json
{
  "id": 456,
  "userId": 1,
  "konuId": 123,
  "videoUrl": "https://www.youtube.com/embed/abc123",
  "noteText": "Güncellenmiş not metni",
  "timestampSeconds": 130,
  "createdAt": "2025-01-15T14:30:00Z",
  "updatedAt": "2025-01-15T16:00:00Z"
}
```

**Controller Örneği:**
```java
@PutMapping("/api/video-notes/{id}")
public ResponseEntity<VideoNoteResponse> updateVideoNote(
    @PathVariable Long id,
    @RequestBody UpdateVideoNoteRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    VideoNote note = videoNoteRepository.findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Video note not found"));
    
    // Sadece kendi notunu güncelleyebilir
    if (!note.getUserId().equals(user.getId())) {
        throw new UnauthorizedException("You can only update your own notes");
    }
    
    if (request.getNoteText() != null) {
        note.setNoteText(request.getNoteText());
    }
    if (request.getTimestampSeconds() != null) {
        note.setTimestampSeconds(request.getTimestampSeconds());
    }
    note.setUpdatedAt(Instant.now());
    
    VideoNote updated = videoNoteRepository.save(note);
    
    return ResponseEntity.ok(VideoNoteResponse.from(updated));
}
```

---

### 4. Video Notu Sil

**Endpoint:** `DELETE /api/video-notes/:id`

**Response:**
```json
{
  "message": "Video note deleted successfully"
}
```

**Controller Örneği:**
```java
@DeleteMapping("/api/video-notes/{id}")
public ResponseEntity<Map<String, String>> deleteVideoNote(
    @PathVariable Long id,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    VideoNote note = videoNoteRepository.findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Video note not found"));
    
    // Sadece kendi notunu silebilir
    if (!note.getUserId().equals(user.getId())) {
        throw new UnauthorizedException("You can only delete your own notes");
    }
    
    videoNoteRepository.delete(note);
    
    return ResponseEntity.ok(Map.of("message", "Video note deleted successfully"));
}
```

---

### 5. Video Notlarını PDF Olarak Dışa Aktar

**Endpoint:** `GET /api/video-notes/export-pdf`

**Query Parameters:**
- `konuId` (optional): Belirli bir konu için notlar
- `videoUrl` (optional): Belirli bir video için notlar

**Response:**
- PDF dosyası (Content-Type: application/pdf)

**Controller Örneği:**
```java
@GetMapping("/api/video-notes/export-pdf")
public ResponseEntity<Resource> exportVideoNotesToPdf(
    @RequestParam(required = false) Long konuId,
    @RequestParam(required = false) String videoUrl,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    List<VideoNote> notes;
    if (konuId != null) {
        notes = videoNoteRepository.findByUserIdAndKonuId(user.getId(), konuId);
    } else if (videoUrl != null) {
        notes = videoNoteRepository.findByUserIdAndVideoUrl(user.getId(), videoUrl);
    } else {
        notes = videoNoteRepository.findByUserId(user.getId());
    }
    
    // PDF oluştur (iText veya Apache PDFBox kullanabilirsiniz)
    byte[] pdfBytes = pdfService.generateVideoNotesPdf(notes, user);
    
    ByteArrayResource resource = new ByteArrayResource(pdfBytes);
    
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=video-notes.pdf")
        .contentType(MediaType.APPLICATION_PDF)
        .contentLength(pdfBytes.length)
        .body(resource);
}
```

---

## 📦 Entity ve DTO Sınıfları

### Entity: `VideoNote.java`

```java
@Entity
@Table(name = "video_note")
public class VideoNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "konu_id", nullable = false)
    private Long konuId;
    
    @Column(name = "video_url", nullable = false)
    private String videoUrl;
    
    @Column(name = "note_text", nullable = false, columnDefinition = "TEXT")
    private String noteText;
    
    @Column(name = "timestamp_seconds", nullable = false)
    private Integer timestampSeconds;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
    
    // Getters and Setters
}
```

### Request DTO: `CreateVideoNoteRequest.java`

```java
public class CreateVideoNoteRequest {
    @NotNull
    private Long konuId;
    
    @NotBlank
    private String videoUrl;
    
    @NotBlank
    private String noteText;
    
    @NotNull
    @Min(0)
    private Integer timestampSeconds;
    
    // Getters and Setters
}
```

### Request DTO: `UpdateVideoNoteRequest.java`

```java
public class UpdateVideoNoteRequest {
    private String noteText;
    private Integer timestampSeconds;
    
    // Getters and Setters
}
```

### Response DTO: `VideoNoteResponse.java`

```java
public class VideoNoteResponse {
    private Long id;
    private Long userId;
    private Long konuId;
    private String videoUrl;
    private String noteText;
    private Integer timestampSeconds;
    private String timestampFormatted;
    private Instant createdAt;
    private Instant updatedAt;
    
    public static VideoNoteResponse from(VideoNote note) {
        VideoNoteResponse response = new VideoNoteResponse();
        response.setId(note.getId());
        response.setUserId(note.getUserId());
        response.setKonuId(note.getKonuId());
        response.setVideoUrl(note.getVideoUrl());
        response.setNoteText(note.getNoteText());
        response.setTimestampSeconds(note.getTimestampSeconds());
        response.setTimestampFormatted(formatTimestamp(note.getTimestampSeconds()));
        response.setCreatedAt(note.getCreatedAt());
        response.setUpdatedAt(note.getUpdatedAt());
        return response;
    }
    
    private static String formatTimestamp(int seconds) {
        int hours = seconds / 3600;
        int minutes = (seconds % 3600) / 60;
        int secs = seconds % 60;
        
        if (hours > 0) {
            return String.format("%d:%02d:%02d", hours, minutes, secs);
        }
        return String.format("%d:%02d", minutes, secs);
    }
    
    // Getters and Setters
}
```

### Response DTO: `VideoNotesResponse.java`

```java
public class VideoNotesResponse {
    private List<VideoNoteResponse> notes;
    
    // Constructor, Getters and Setters
}
```

---

## 🔍 Repository Metodları

### `VideoNoteRepository.java`

```java
@Repository
public interface VideoNoteRepository extends JpaRepository<VideoNote, Long> {
    List<VideoNote> findByUserId(Long userId);
    List<VideoNote> findByUserIdAndKonuId(Long userId, Long konuId);
    List<VideoNote> findByUserIdAndVideoUrl(Long userId, String videoUrl);
    List<VideoNote> findByUserIdOrderByTimestampSecondsAsc(Long userId);
    List<VideoNote> findByUserIdAndKonuIdOrderByTimestampSecondsAsc(Long userId, Long konuId);
}
```

---

## ✅ Test Senaryoları

1. **Video Notu Oluştur**
   - ✅ Geçerli verilerle not oluşturma
   - ✅ Zaman damgası doğru kaydedilmeli
   - ✅ Sadece authenticated kullanıcılar not oluşturabilmeli

2. **Video Notlarını Getir**
   - ✅ Kullanıcının kendi notlarını görmesi
   - ✅ Konu ID ile filtreleme
   - ✅ Video URL ile filtreleme
   - ✅ Zaman damgasına göre sıralama

3. **Video Notu Güncelle**
   - ✅ Sadece kendi notunu güncelleyebilme
   - ✅ Not metni güncelleme
   - ✅ Zaman damgası güncelleme

4. **Video Notu Sil**
   - ✅ Sadece kendi notunu silebilme
   - ✅ Başarılı silme işlemi

5. **PDF Dışa Aktarma**
   - ✅ Tüm notları PDF olarak dışa aktarma
   - ✅ Konu ID ile filtreli PDF
   - ✅ Video URL ile filtreli PDF

---

## 🚀 Kurulum Adımları

1. **Database Migration**
   ```sql
   -- Yukarıdaki CREATE TABLE komutunu çalıştırın
   ```

2. **Entity ve Repository Oluştur**
   - `VideoNote.java` entity
   - `VideoNoteRepository.java` repository

3. **DTO'ları Oluştur**
   - `CreateVideoNoteRequest.java`
   - `UpdateVideoNoteRequest.java`
   - `VideoNoteResponse.java`
   - `VideoNotesResponse.java`

4. **Controller Oluştur**
   - `VideoNoteController.java` veya mevcut bir controller'a ekle

5. **PDF Servisi Oluştur (Opsiyonel)**
   - `PdfService.java` - PDF oluşturma servisi

6. **Test Et**
   - Postman veya frontend'den test edin

---

## 📝 Notlar

- Her kullanıcı sadece kendi notlarını görebilir ve düzenleyebilir
- Notlar zaman damgasına göre sıralanmalı
- PDF dışa aktarma özelliği opsiyoneldir
- Zaman damgası saniye cinsinden tutuluyor (frontend'de formatlanacak)

---

## 🔗 İlgili Dosyalar

- **Frontend:** `src/DersDetay.jsx` (Video not alma UI)
- **Backend:** `VideoNoteController.java`, `VideoNoteRepository.java`


