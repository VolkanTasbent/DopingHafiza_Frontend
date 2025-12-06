# 📋 Son Aktivitelerim - Backend Kurulum Rehberi

## 📋 Özet

"Son Aktivitelerim" özelliği için backend'de aktivite kayıtlarını tutacak bir tablo ve endpoint'ler gereklidir. Bu özellik kullanıcının son yaptığı aktiviteleri (soru çözme, video izleme, konu çalışma vb.) gösterir.

---

## 🗄️ Database Yapısı

### 1. `user_activity` Tablosu Oluştur

```sql
CREATE TABLE user_activity (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'soru_cozme', 'video_izleme', 'konu_calisma', 'ders_tamamlama', 'pomodoro'
    activity_title VARCHAR(255) NOT NULL, -- Örn: "TYT Tarih > Tarih ve Zaman"
    activity_subtitle VARCHAR(255), -- Örn: "Tarihin Tanımı, Yöntemi ve..."
    activity_icon VARCHAR(50) DEFAULT 'document', -- 'document', 'video', 'book', 'grid', 'abc'
    ders_id BIGINT REFERENCES ders(id) ON DELETE SET NULL,
    konu_id BIGINT REFERENCES konu(id) ON DELETE SET NULL,
    rapor_id BIGINT REFERENCES rapor(id) ON DELETE SET NULL, -- Soru çözme aktiviteleri için
    metadata JSONB, -- Ek bilgiler (soru sayısı, süre, net vb.)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES "user"(id)
);

-- Index'ler
CREATE INDEX idx_user_activity_user_date ON user_activity(user_id, created_at DESC);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at DESC);
```

---

## 🔌 API Endpoint'leri

### 1. Son Aktiviteleri Getir

**Endpoint:** `GET /api/activities/recent`

**Query Parameters:**
- `limit` (optional): Son kaç aktivite getirilecek (default: 10, max: 50)

**Response:**
```json
{
  "activities": [
    {
      "id": 123,
      "activityType": "soru_cozme",
      "activityTitle": "TYT Tarih > Tarih ve Zaman",
      "activitySubtitle": "Tarihin Tanımı, Yöntemi ve...",
      "activityIcon": "abc",
      "dersId": 5,
      "konuId": 12,
      "createdAt": "2025-01-15T14:30:00Z",
      "metadata": {
        "soruSayisi": 20,
        "dogru": 15,
        "yanlis": 3,
        "net": 14.25
      }
    },
    {
      "id": 122,
      "activityType": "video_izleme",
      "activityTitle": "TYT Fizik > Fizik Bilimine Giriş",
      "activitySubtitle": "Fizik ve Ölçme",
      "activityIcon": "video",
      "dersId": 3,
      "konuId": 8,
      "createdAt": "2025-01-15T13:20:00Z",
      "metadata": {
        "videoSuresi": 25,
        "izlenmeYuzdesi": 100
      }
    }
  ]
}
```

**Controller Örneği (Java Spring Boot):**
```java
@GetMapping("/api/activities/recent")
public ResponseEntity<RecentActivitiesResponse> getRecentActivities(
    @RequestParam(defaultValue = "10") int limit,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    // Limit kontrolü
    int actualLimit = Math.min(Math.max(limit, 1), 50);
    
    List<UserActivity> activities = userActivityRepository
        .findByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(0, actualLimit));
    
    List<ActivityResponse> activityResponses = activities.stream()
        .map(ActivityResponse::from)
        .collect(Collectors.toList());
    
    RecentActivitiesResponse response = new RecentActivitiesResponse();
    response.setActivities(activityResponses);
    
    return ResponseEntity.ok(response);
}
```

---

### 2. Aktivite Kaydet

**Endpoint:** `POST /api/activities`

**Request Body:**
```json
{
  "activityType": "soru_cozme",
  "activityTitle": "TYT Tarih > Tarih ve Zaman",
  "activitySubtitle": "Tarihin Tanımı, Yöntemi ve...",
  "activityIcon": "abc",
  "dersId": 5,
  "konuId": 12,
  "raporId": 456,
  "metadata": {
    "soruSayisi": 20,
    "dogru": 15,
    "yanlis": 3,
    "net": 14.25
  }
}
```

**Response:**
```json
{
  "id": 123,
  "activityType": "soru_cozme",
  "activityTitle": "TYT Tarih > Tarih ve Zaman",
  "activitySubtitle": "Tarihin Tanımı, Yöntemi ve...",
  "activityIcon": "abc",
  "createdAt": "2025-01-15T14:30:00Z"
}
```

**Controller Örneği:**
```java
@PostMapping("/api/activities")
public ResponseEntity<ActivityResponse> createActivity(
    @RequestBody CreateActivityRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    UserActivity activity = new UserActivity();
    activity.setUserId(user.getId());
    activity.setActivityType(request.getActivityType());
    activity.setActivityTitle(request.getActivityTitle());
    activity.setActivitySubtitle(request.getActivitySubtitle());
    activity.setActivityIcon(request.getActivityIcon() != null 
        ? request.getActivityIcon() 
        : "document");
    activity.setDersId(request.getDersId());
    activity.setKonuId(request.getKonuId());
    activity.setRaporId(request.getRaporId());
    activity.setMetadata(request.getMetadata());
    
    UserActivity saved = userActivityRepository.save(activity);
    
    return ResponseEntity.ok(ActivityResponse.from(saved));
}
```

---

## 📦 Entity ve DTO Sınıfları

### Entity: `UserActivity.java`

```java
@Entity
@Table(name = "user_activity")
public class UserActivity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "activity_type", nullable = false, length = 50)
    private String activityType;
    
    @Column(name = "activity_title", nullable = false, length = 255)
    private String activityTitle;
    
    @Column(name = "activity_subtitle", length = 255)
    private String activitySubtitle;
    
    @Column(name = "activity_icon", length = 50)
    private String activityIcon = "document";
    
    @Column(name = "ders_id")
    private Long dersId;
    
    @Column(name = "konu_id")
    private Long konuId;
    
    @Column(name = "rapor_id")
    private Long raporId;
    
    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    
    // Getters and Setters
}
```

### Request DTO: `CreateActivityRequest.java`

```java
public class CreateActivityRequest {
    @NotBlank
    @Pattern(regexp = "soru_cozme|video_izleme|konu_calisma|ders_tamamlama|pomodoro")
    private String activityType;
    
    @NotBlank
    private String activityTitle;
    
    private String activitySubtitle;
    
    @Pattern(regexp = "document|video|book|grid|abc")
    private String activityIcon;
    
    private Long dersId;
    
    private Long konuId;
    
    private Long raporId;
    
    private Map<String, Object> metadata;
    
    // Getters and Setters
}
```

### Response DTO: `ActivityResponse.java`

```java
public class ActivityResponse {
    private Long id;
    private String activityType;
    private String activityTitle;
    private String activitySubtitle;
    private String activityIcon;
    private Long dersId;
    private Long konuId;
    private Instant createdAt;
    private Map<String, Object> metadata;
    
    public static ActivityResponse from(UserActivity activity) {
        ActivityResponse response = new ActivityResponse();
        response.setId(activity.getId());
        response.setActivityType(activity.getActivityType());
        response.setActivityTitle(activity.getActivityTitle());
        response.setActivitySubtitle(activity.getActivitySubtitle());
        response.setActivityIcon(activity.getActivityIcon());
        response.setDersId(activity.getDersId());
        response.setKonuId(activity.getKonuId());
        response.setCreatedAt(activity.getCreatedAt());
        response.setMetadata(activity.getMetadata());
        return response;
    }
    
    // Getters and Setters
}
```

### Response DTO: `RecentActivitiesResponse.java`

```java
public class RecentActivitiesResponse {
    private List<ActivityResponse> activities;
    
    // Getters and Setters
}
```

---

## 🔄 Repository Interface

```java
@Repository
public interface UserActivityRepository extends JpaRepository<UserActivity, Long> {
    List<UserActivity> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    
    @Query("SELECT a FROM UserActivity a WHERE a.userId = :userId ORDER BY a.createdAt DESC")
    List<UserActivity> findRecentByUserId(@Param("userId") Long userId, Pageable pageable);
}
```

---

## 🎯 Aktivite Kayıt Senaryoları

### 1. Soru Çözme Aktivitesi

Soru çözme tamamlandığında (quiz submit edildiğinde) aktivite kaydedilmeli:

```java
// QuizController.java içinde submitQuiz metodunda
@PostMapping("/api/quiz/submit")
public ResponseEntity<QuizResultResponse> submitQuiz(
    @RequestBody QuizSubmitRequest request,
    Authentication authentication
) {
    // ... mevcut quiz submit kodu ...
    
    // Aktivite kaydet
    UserActivity activity = new UserActivity();
    activity.setUserId(user.getId());
    activity.setActivityType("soru_cozme");
    
    // Ders ve konu bilgilerini al
    Ders ders = // ... ders bilgisi ...
    Konu konu = // ... konu bilgisi ...
    
    activity.setActivityTitle(ders.getAd() + " > " + konu.getAd());
    activity.setActivitySubtitle(/* konu detayı */);
    activity.setActivityIcon("abc");
    activity.setDersId(ders.getId());
    activity.setKonuId(konu.getId());
    activity.setRaporId(rapor.getId());
    
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("soruSayisi", rapor.getTotalCount());
    metadata.put("dogru", rapor.getCorrectCount());
    metadata.put("yanlis", rapor.getWrongCount());
    metadata.put("net", rapor.getNet());
    activity.setMetadata(metadata);
    
    userActivityRepository.save(activity);
    
    // ... response dön ...
}
```

### 2. Video İzleme Aktivitesi

**Frontend'de:** `DersDetay.jsx` dosyasında video oynatıldığında otomatik olarak `POST /api/activities` endpoint'ine istek gönderilir.

**Backend'de:** Video izleme aktivitesi kaydedilirken:

**Yöntem 1: Frontend'den direkt POST /api/activities (Önerilen)**
Frontend zaten `POST /api/activities` endpoint'ini kullanıyor. Backend'de bu endpoint hazır olmalı.

**Yöntem 2: Özel endpoint (Alternatif)**
```java
@PostMapping("/api/videos/{videoId}/watch")
public ResponseEntity<Void> markVideoWatched(
    @PathVariable Long videoId,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    // Video bilgilerini al
    Video video = videoRepository.findById(videoId).orElseThrow();
    Ders ders = video.getDers();
    Konu konu = video.getKonu();
    
    // Aktivite kaydet
    UserActivity activity = new UserActivity();
    activity.setUserId(user.getId());
    activity.setActivityType("video_izleme");
    activity.setActivityTitle(ders.getAd() + " > " + konu.getAd());
    activity.setActivitySubtitle(video.getBaslik());
    activity.setActivityIcon("video");
    activity.setDersId(ders.getId());
    activity.setKonuId(konu.getId());
    
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("videoSuresi", video.getSure());
    metadata.put("izlenmeYuzdesi", 100);
    activity.setMetadata(metadata);
    
    userActivityRepository.save(activity);
    
    return ResponseEntity.ok().build();
}
```

**Frontend Entegrasyonu:**
- `DersDetay.jsx` içinde video elementine `onPlay` ve `onEnded` event handler'ları eklenmiştir
- Video oynatılmaya başlandığında veya tamamlandığında aktivite kaydedilir
- YouTube iframe'ler için `onLoad` event'i kullanılır

### 3. Pomodoro Aktivitesi

Pomodoro tamamlandığında (zaten pomodoro_session tablosu var, buradan aktivite oluşturulabilir):

```java
// PomodoroController.java içinde
@PostMapping("/api/pomodoro/session")
public ResponseEntity<PomodoroSessionResponse> saveSession(
    @RequestBody PomodoroSessionRequest request,
    Authentication authentication
) {
    // ... mevcut pomodoro kayıt kodu ...
    
    // Aktivite kaydet
    UserActivity activity = new UserActivity();
    activity.setUserId(user.getId());
    activity.setActivityType("pomodoro");
    activity.setActivityTitle("Pomodoro Çalışması");
    activity.setActivitySubtitle(request.getDuration() + " dakika çalışma");
    activity.setActivityIcon("grid");
    
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("duration", request.getDuration());
    activity.setMetadata(metadata);
    
    userActivityRepository.save(activity);
    
    // ... response dön ...
}
```

---

## 📊 SQL Sorguları

### Son 10 Aktiviteyi Getir
```sql
SELECT 
    id,
    activity_type,
    activity_title,
    activity_subtitle,
    activity_icon,
    ders_id,
    konu_id,
    created_at,
    metadata
FROM user_activity
WHERE user_id = :userId
ORDER BY created_at DESC  -- ÖNEMLİ: En yeni aktiviteler en üstte (DESC)
LIMIT 10;
```

**NOT:** Sıralama her zaman `DESC` (en yeni en üstte) olmalıdır. Frontend'de de bu sıralama beklenir.

### Belirli Bir Aktivite Tipine Göre Filtrele
```sql
SELECT *
FROM user_activity
WHERE user_id = :userId
  AND activity_type = :activityType
ORDER BY created_at DESC
LIMIT 20;
```

---

## ✅ Test Senaryoları

1. **Aktivite Kaydet**
   - ✅ Geçerli aktivite tipi ile kayıt
   - ✅ Tüm alanlar doldurulmuş kayıt
   - ✅ Sadece zorunlu alanlarla kayıt
   - ✅ Sadece authenticated kullanıcılar kayıt yapabilmeli

2. **Son Aktiviteleri Getir**
   - ✅ Son 10 aktiviteyi getir
   - ✅ Limit parametresi ile farklı sayıda aktivite getir
   - ✅ Sadece authenticated kullanıcılar kendi aktivitelerini görebilmeli
   - ✅ Aktivite yoksa boş liste dönmeli

3. **Aktivite Tipleri**
   - ✅ soru_cozme
   - ✅ video_izleme
   - ✅ konu_calisma
   - ✅ ders_tamamlama
   - ✅ pomodoro

---

## 🚀 Kurulum Adımları

1. **Database Migration**
   ```sql
   -- Yukarıdaki CREATE TABLE komutunu çalıştırın
   ```

2. **Entity ve Repository Oluştur**
   - `UserActivity.java` entity
   - `UserActivityRepository.java` repository

3. **DTO'ları Oluştur**
   - `CreateActivityRequest.java`
   - `ActivityResponse.java`
   - `RecentActivitiesResponse.java`

4. **Controller Oluştur**
   - `ActivityController.java` veya mevcut bir controller'a ekle

5. **Mevcut Endpoint'lere Aktivite Kaydı Ekle**
   - Quiz submit endpoint'ine
   - Video izleme endpoint'ine
   - Pomodoro session endpoint'ine

6. **Test Et**
   - Postman veya frontend'den test edin

---

## 📝 Notlar

- Aktivite kayıtları otomatik olarak oluşturulmalı (kullanıcı manuel kayıt yapmamalı)
- Her aktivite tipi için uygun icon seçilmeli
- Metadata alanı esnek kullanım için JSONB olarak tutuluyor
- Aktivite kayıtları silinmemeli (sadece yeni kayıtlar eklenmeli)
- Performans için index'ler eklendi

---

## 🔗 İlgili Dosyalar

- **Frontend:** `src/Dashboard.jsx` (Son Aktivitelerim bölümü)
- **Backend:** Quiz, Video, Pomodoro endpoint'leri (aktivite kaydı eklenecek)

