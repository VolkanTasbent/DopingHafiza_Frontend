# 🍅 Pomodoro Timer - Backend Kurulum Rehberi

## 📋 Özet

Pomodoro Timer özelliği için backend'de aşağıdaki endpoint'ler ve database yapısı gereklidir.

---

## 🗄️ Database Yapısı

### 1. `pomodoro_session` Tablosu Oluştur

```sql
CREATE TABLE pomodoro_session (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    duration INTEGER NOT NULL, -- Dakika cinsinden (örn: 25)
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES "user"(id)
);

-- Index'ler
CREATE INDEX idx_pomodoro_user_date ON pomodoro_session(user_id, completed_at);
CREATE INDEX idx_pomodoro_completed_at ON pomodoro_session(completed_at);
```

---

## 🔌 API Endpoint'leri

### 1. Pomodoro Oturumu Kaydet

**Endpoint:** `POST /api/pomodoro/session`

**Request Body:**
```json
{
  "duration": 25,
  "completedAt": "2025-01-15T14:30:00Z"
}
```

**Response:**
```json
{
  "id": 123,
  "userId": 1,
  "duration": 25,
  "completedAt": "2025-01-15T14:30:00Z",
  "createdAt": "2025-01-15T14:30:00Z"
}
```

**Controller Örneği (Java Spring Boot):**
```java
@PostMapping("/api/pomodoro/session")
public ResponseEntity<PomodoroSessionResponse> saveSession(
    @RequestBody PomodoroSessionRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    PomodoroSession session = new PomodoroSession();
    session.setUserId(user.getId());
    session.setDuration(request.getDuration());
    session.setCompletedAt(request.getCompletedAt() != null 
        ? Instant.parse(request.getCompletedAt()) 
        : Instant.now());
    
    PomodoroSession saved = pomodoroSessionRepository.save(session);
    
    return ResponseEntity.ok(PomodoroSessionResponse.from(saved));
}
```

---

### 2. Pomodoro İstatistikleri Getir

**Endpoint:** `GET /api/pomodoro/stats`

**Response:**
```json
{
  "today": {
    "count": 4,
    "minutes": 100
  },
  "week": {
    "count": 18,
    "minutes": 450
  },
  "month": {
    "count": 72,
    "minutes": 1800
  },
  "total": {
    "count": 150,
    "minutes": 3750
  }
}
```

**Controller Örneği (Java Spring Boot):**
```java
@GetMapping("/api/pomodoro/stats")
public ResponseEntity<PomodoroStatsResponse> getStats(Authentication authentication) {
    User user = (User) authentication.getPrincipal();
    Long userId = user.getId();
    
    Instant now = Instant.now();
    Instant todayStart = now.atZone(ZoneId.systemDefault())
        .toLocalDate()
        .atStartOfDay(ZoneId.systemDefault())
        .toInstant();
    Instant weekStart = todayStart.minus(7, ChronoUnit.DAYS);
    Instant monthStart = todayStart.minus(30, ChronoUnit.DAYS);
    
    // Bugün
    List<PomodoroSession> todaySessions = pomodoroSessionRepository
        .findByUserIdAndCompletedAtAfter(userId, todayStart);
    int todayCount = todaySessions.size();
    int todayMinutes = todaySessions.stream()
        .mapToInt(PomodoroSession::getDuration)
        .sum();
    
    // Bu Hafta
    List<PomodoroSession> weekSessions = pomodoroSessionRepository
        .findByUserIdAndCompletedAtAfter(userId, weekStart);
    int weekCount = weekSessions.size();
    int weekMinutes = weekSessions.stream()
        .mapToInt(PomodoroSession::getDuration)
        .sum();
    
    // Bu Ay
    List<PomodoroSession> monthSessions = pomodoroSessionRepository
        .findByUserIdAndCompletedAtAfter(userId, monthStart);
    int monthCount = monthSessions.size();
    int monthMinutes = monthSessions.stream()
        .mapToInt(PomodoroSession::getDuration)
        .sum();
    
    // Toplam
    List<PomodoroSession> allSessions = pomodoroSessionRepository
        .findByUserId(userId);
    int totalCount = allSessions.size();
    int totalMinutes = allSessions.stream()
        .mapToInt(PomodoroSession::getDuration)
        .sum();
    
    PomodoroStatsResponse stats = new PomodoroStatsResponse();
    stats.setToday(new PomodoroPeriodStats(todayCount, todayMinutes));
    stats.setWeek(new PomodoroPeriodStats(weekCount, weekMinutes));
    stats.setMonth(new PomodoroPeriodStats(monthCount, monthMinutes));
    stats.setTotal(new PomodoroPeriodStats(totalCount, totalMinutes));
    
    return ResponseEntity.ok(stats);
}
```

---

## 📦 Entity ve DTO Sınıfları

### Entity: `PomodoroSession.java`

```java
@Entity
@Table(name = "pomodoro_session")
public class PomodoroSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(nullable = false)
    private Integer duration; // Dakika
    
    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    
    // Getters and Setters
}
```

### Request DTO: `PomodoroSessionRequest.java`

```java
public class PomodoroSessionRequest {
    @NotNull
    @Min(1)
    @Max(60)
    private Integer duration;
    
    private String completedAt; // ISO 8601 format
    
    // Getters and Setters
}
```

### Response DTO: `PomodoroSessionResponse.java`

```java
public class PomodoroSessionResponse {
    private Long id;
    private Long userId;
    private Integer duration;
    private String completedAt;
    private String createdAt;
    
    public static PomodoroSessionResponse from(PomodoroSession session) {
        PomodoroSessionResponse response = new PomodoroSessionResponse();
        response.setId(session.getId());
        response.setUserId(session.getUserId());
        response.setDuration(session.getDuration());
        response.setCompletedAt(session.getCompletedAt().toString());
        response.setCreatedAt(session.getCreatedAt().toString());
        return response;
    }
    
    // Getters and Setters
}
```

### Response DTO: `PomodoroStatsResponse.java`

```java
public class PomodoroStatsResponse {
    private PomodoroPeriodStats today;
    private PomodoroPeriodStats week;
    private PomodoroPeriodStats month;
    private PomodoroPeriodStats total;
    
    // Getters and Setters
}

public class PomodoroPeriodStats {
    private Integer count;
    private Integer minutes;
    
    public PomodoroPeriodStats(Integer count, Integer minutes) {
        this.count = count;
        this.minutes = minutes;
    }
    
    // Getters and Setters
}
```

---

## 🔍 Repository Interface

```java
@Repository
public interface PomodoroSessionRepository extends JpaRepository<PomodoroSession, Long> {
    List<PomodoroSession> findByUserId(Long userId);
    
    List<PomodoroSession> findByUserIdAndCompletedAtAfter(Long userId, Instant after);
}
```

---

## 🔒 Güvenlik

- Her iki endpoint de **authenticated** olmalı (JWT token gerekli)
- Kullanıcı sadece kendi pomodoro oturumlarını görebilmeli
- `POST /api/pomodoro/session` endpoint'inde `userId` authentication'dan alınmalı (request body'den değil)

---

## 📊 SQL Sorgu Örnekleri

### Günlük İstatistikler
```sql
SELECT 
    COUNT(*) as count,
    SUM(duration) as minutes
FROM pomodoro_session
WHERE user_id = :userId
  AND completed_at >= CURRENT_DATE;
```

### Haftalık İstatistikler
```sql
SELECT 
    COUNT(*) as count,
    SUM(duration) as minutes
FROM pomodoro_session
WHERE user_id = :userId
  AND completed_at >= CURRENT_DATE - INTERVAL '7 days';
```

### Aylık İstatistikler
```sql
SELECT 
    COUNT(*) as count,
    SUM(duration) as minutes
FROM pomodoro_session
WHERE user_id = :userId
  AND completed_at >= CURRENT_DATE - INTERVAL '30 days';
```

---

## ✅ Test Senaryoları

1. **Pomodoro Oturumu Kaydet**
   - ✅ Geçerli duration (1-60 dakika) ile kayıt
   - ✅ completedAt belirtilmişse o tarih kullanılmalı
   - ✅ completedAt belirtilmemişse şu anki zaman kullanılmalı
   - ✅ Sadece authenticated kullanıcılar kayıt yapabilmeli

2. **İstatistikleri Getir**
   - ✅ Bugünkü pomodoro sayısı ve toplam dakika
   - ✅ Bu haftaki pomodoro sayısı ve toplam dakika
   - ✅ Bu ayki pomodoro sayısı ve toplam dakika
   - ✅ Tüm zamanların pomodoro sayısı ve toplam dakika
   - ✅ Sadece authenticated kullanıcılar kendi istatistiklerini görebilmeli

---

## 🚀 Kurulum Adımları

1. **Database Migration**
   ```sql
   -- Yukarıdaki CREATE TABLE komutunu çalıştırın
   ```

2. **Entity ve Repository Oluştur**
   - `PomodoroSession.java` entity
   - `PomodoroSessionRepository.java` repository

3. **DTO'ları Oluştur**
   - `PomodoroSessionRequest.java`
   - `PomodoroSessionResponse.java`
   - `PomodoroStatsResponse.java`
   - `PomodoroPeriodStats.java`

4. **Controller Oluştur**
   - `PomodoroController.java` veya mevcut bir controller'a ekle

5. **Test Et**
   - Postman veya frontend'den test edin

---

## 📝 Notlar

- Frontend, backend hata verse bile local storage'a kayıt yapıyor (fallback mekanizması)
- Backend hazır olduğunda, frontend otomatik olarak backend'i kullanacak
- `duration` her zaman dakika cinsinden (25, 5, 15 gibi)
- `completedAt` ISO 8601 formatında string olarak gönderiliyor

---

## 🔗 İlgili Dosyalar

- **Frontend:** `src/PomodoroTimer.jsx`
- **Frontend Widget:** `src/Dashboard.jsx` (PomodoroTimer widget olarak)
- **Frontend Routing:** `src/App.jsx`


