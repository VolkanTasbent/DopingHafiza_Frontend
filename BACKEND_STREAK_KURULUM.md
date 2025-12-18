# 🔥 Günlük Seri (Streak) Sistemi - Backend Kurulum Rehberi

## 📋 Özet

Günlük seri (streak) sistemi, kullanıcıların ardışık günlerde sisteme giriş yapmasını teşvik eder. **Sadece giriş yapmak streak için yeterlidir** - herhangi bir aktivite (quiz, pomodoro vb.) yapmaya gerek yoktur. Bu sistem backend'de database'de tutulur ve kullanıcı her giriş yaptığında otomatik olarak güncellenir.

---

## 🗄️ Database Yapısı

### 1. User Tablosuna Streak Kolonları Ekle

```sql
-- User tablosuna streak kolonları ekle
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_date DATE;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_user_streak ON "user"(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_user_last_activity ON "user"(last_activity_date);
```

### 2. Aktivite Takip Tablosu (Opsiyonel - Daha Detaylı Takip İçin)

Eğer daha detaylı aktivite takibi istiyorsanız:

```sql
CREATE TABLE user_daily_activity (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'quiz', 'pomodoro', 'video', 'flashcard'
    activity_count INTEGER DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_activity FOREIGN KEY (user_id) REFERENCES "user"(id),
    CONSTRAINT unique_user_date_type UNIQUE (user_id, activity_date, activity_type)
);

-- Index'ler
CREATE INDEX idx_activity_user_date ON user_daily_activity(user_id, activity_date);
CREATE INDEX idx_activity_date ON user_daily_activity(activity_date);
```

---

## 🔌 API Endpoint'leri

### 1. Kullanıcı Streak Bilgisini Getir

**Endpoint:** `GET /api/users/me`

**Response (Güncellenmiş):**
```json
{
  "id": 1,
  "ad": "Ahmet",
  "soyad": "Yılmaz",
  "email": "ahmet@example.com",
  "puan": 4520,
  "currentStreak": 7,
  "longestStreak": 12,
  "lastActivityDate": "2025-01-15"
}
```

**Controller Örneği (Java Spring Boot):**

```java
@GetMapping("/api/users/me")
public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
    User user = (User) authentication.getPrincipal();
    
    // Streak bilgilerini dahil et
    UserResponse response = UserResponse.from(user);
    response.setCurrentStreak(user.getCurrentStreak() != null ? user.getCurrentStreak() : 0);
    response.setLongestStreak(user.getLongestStreak() != null ? user.getLongestStreak() : 0);
    response.setLastActivityDate(user.getLastActivityDate());
    
    return ResponseEntity.ok(response);
}
```

---

### 2. Streak Güncelleme (Otomatik)

**Açıklama:** Streak güncellemesi otomatik olarak yapılır. Her aktivite (quiz, pomodoro, video izleme vb.) sonrası streak kontrol edilir ve güncellenir.

**Kullanım Senaryoları:**
- Quiz tamamlandığında
- Pomodoro oturumu bittiğinde
- Video izlendiğinde
- Flashcard çalışıldığında

**Service Metodu:**

```java
@Service
public class StreakService {
    
    @Autowired
    private UserRepository userRepository;
    
    /**
     * Kullanıcının streak'ini güncelle
     * @param userId Kullanıcı ID
     * @param activityDate Aktivite tarihi (null ise bugün)
     */
    public void updateStreak(Long userId, LocalDate activityDate) {
        if (activityDate == null) {
            activityDate = LocalDate.now();
        }
        
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found"));
        
        LocalDate lastActivity = user.getLastActivityDate();
        Integer currentStreak = user.getCurrentStreak() != null ? user.getCurrentStreak() : 0;
        Integer longestStreak = user.getLongestStreak() != null ? user.getLongestStreak() : 0;
        
        // Bugün aktivite yapıldıysa streak'i güncelle
        if (lastActivity == null) {
            // İlk aktivite
            user.setCurrentStreak(1);
            user.setLongestStreak(1);
            user.setLastActivityDate(activityDate);
        } else if (lastActivity.equals(activityDate)) {
            // Bugün zaten aktivite yapılmış, streak değişmez
            // Hiçbir şey yapma
        } else if (lastActivity.equals(activityDate.minusDays(1))) {
            // Dün aktivite yapılmış, streak devam ediyor
            int newStreak = currentStreak + 1;
            user.setCurrentStreak(newStreak);
            
            // En uzun streak'i güncelle
            if (newStreak > longestStreak) {
                user.setLongestStreak(newStreak);
            }
            
            user.setLastActivityDate(activityDate);
        } else {
            // Streak bozuldu, sıfırla
            user.setCurrentStreak(1);
            user.setLastActivityDate(activityDate);
        }
        
        userRepository.save(user);
    }
    
    /**
     * Kullanıcının bugün aktivite yapıp yapmadığını kontrol et
     */
    public boolean hasActivityToday(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found"));
        
        LocalDate today = LocalDate.now();
        LocalDate lastActivity = user.getLastActivityDate();
        
        return lastActivity != null && lastActivity.equals(today);
    }
    
    /**
     * Kullanıcının streak bilgilerini getir
     */
    public StreakInfo getStreakInfo(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found"));
        
        StreakInfo info = new StreakInfo();
        info.setCurrentStreak(user.getCurrentStreak() != null ? user.getCurrentStreak() : 0);
        info.setLongestStreak(user.getLongestStreak() != null ? user.getLongestStreak() : 0);
        info.setLastActivityDate(user.getLastActivityDate());
        
        // Bir sonraki streak bonusu için kalan gün
        int currentStreak = info.getCurrentStreak();
        if (currentStreak < 3) {
            info.setDaysUntilNextBonus(3 - currentStreak);
        } else if (currentStreak < 7) {
            info.setDaysUntilNextBonus(7 - currentStreak);
        } else if (currentStreak < 30) {
            info.setDaysUntilNextBonus(30 - currentStreak);
        } else {
            info.setDaysUntilNextBonus(0);
        }
        
        return info;
    }
}
```

---

### 3. Login Endpoint'inde Streak Güncelle (ÖNEMLİ)

**⚠️ ÖNEMLİ:** Streak güncellemesi **login endpoint'inde** yapılmalıdır. Kullanıcı sadece giriş yaparak streak'ini artırabilir.

**Endpoint:** `POST /api/auth/login`

**Controller Örneği:**

```java
@PostMapping("/api/auth/login")
public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
    // Kullanıcı doğrulama
    User user = userRepository.findByEmail(request.getEmail())
        .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
    
    if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
        throw new BadCredentialsException("Invalid credentials");
    }
    
    // ✅ Streak'i güncelle (sadece giriş yapmak yeterli)
    streakService.updateStreak(user.getId(), LocalDate.now());
    
    // Token oluştur
    String token = jwtTokenProvider.generateToken(user);
    
    // Kullanıcı bilgilerini güncelle (streak bilgisi dahil)
    user = userRepository.findById(user.getId()).orElse(user);
    
    LoginResponse response = new LoginResponse();
    response.setToken(token);
    response.setUser(UserResponse.from(user));
    
    return ResponseEntity.ok(response);
}
```

---

### 4. Quiz Tamamlandığında Streak Güncelle (Opsiyonel)

**Not:** Streak artık sadece giriş yapmakla güncelleniyor. Quiz çözme streak'i etkilemez, ancak isterseniz ek bonus verebilirsiniz.

**Endpoint:** `POST /api/quiz/submit` veya `POST /api/raporlar`

**Controller Örneği:**

```java
@PostMapping("/api/quiz/submit")
public ResponseEntity<QuizResponse> submitQuiz(
    @RequestBody QuizRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    // Quiz sonuçlarını kaydet
    Rapor rapor = new Rapor();
    // ... rapor bilgilerini set et
    Rapor saved = raporRepository.save(rapor);
    
    // Streak güncelleme artık login'de yapılıyor, burada gerekmez
    // Ancak isterseniz ek bonus verebilirsiniz
    
    return ResponseEntity.ok(QuizResponse.from(saved));
}
```

---

### 5. Pomodoro Tamamlandığında Streak Güncelle (Opsiyonel)

**Endpoint:** `POST /api/pomodoro/session`

**Controller Örneği:**

```java
@PostMapping("/api/pomodoro/session")
public ResponseEntity<PomodoroSessionResponse> saveSession(
    @RequestBody PomodoroSessionRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    // Pomodoro oturumunu kaydet
    PomodoroSession session = new PomodoroSession();
    // ... session bilgilerini set et
    PomodoroSession saved = pomodoroSessionRepository.save(session);
    
    // Streak güncelleme artık login'de yapılıyor, burada gerekmez
    
    return ResponseEntity.ok(PomodoroSessionResponse.from(saved));
}
```

---

### 5. Streak İstatistikleri Getir

**Endpoint:** `GET /api/users/streak`

**Response:**
```json
{
  "currentStreak": 7,
  "longestStreak": 12,
  "lastActivityDate": "2025-01-15",
  "daysUntilNextBonus": 0,
  "nextBonusAt": 7,
  "bonusInfo": {
    "nextBonus": "7 Günlük Seri",
    "reward": "+50 puan bonusu"
  }
}
```

**Controller:**

```java
@GetMapping("/api/users/streak")
public ResponseEntity<StreakInfo> getStreakInfo(Authentication authentication) {
    User user = (User) authentication.getPrincipal();
    StreakInfo info = streakService.getStreakInfo(user.getId());
    return ResponseEntity.ok(info);
}
```

---

## 📊 Streak Bonusları

### Puan Bonusları

- **3 Günlük Streak:** +20 puan
- **7 Günlük Streak:** +50 puan
- **30 Günlük Streak:** +200 puan

### Rozet Ödülleri

- **3 Günlük Streak:** 🔥 Seri Başlangıcı Rozeti
- **7 Günlük Streak:** 💥 Alevli Seri Ustası Rozeti
- **30 Günlük Streak:** 🏆 Seri Efsanesi Rozeti

---

## 🔄 Otomatik Streak Güncelleme Stratejileri

### Strateji 1: Login Endpoint'inde Güncelle (ÖNERİLEN)

**✅ ÖNERİLEN:** Streak güncellemesi sadece login endpoint'inde yapılır. Kullanıcı her giriş yaptığında streak otomatik güncellenir:

```java
@PostMapping("/api/auth/login")
public ResponseEntity<?> login(...) {
    // Kullanıcı doğrulama
    // ...
    
    // Streak güncelle (sadece giriş yapmak yeterli)
    streakService.updateStreak(user.getId(), LocalDate.now());
    
    return ResponseEntity.ok(...);
}
```

### Strateji 2: Background Job ile Günlük Kontrol

Her gün gece yarısı streak'leri kontrol et ve güncelle:

```java
@Scheduled(cron = "0 0 0 * * *") // Her gün gece yarısı
public void checkAndUpdateStreaks() {
    List<User> users = userRepository.findAll();
    
    for (User user : users) {
        LocalDate lastActivity = user.getLastActivityDate();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        
        // Eğer dün aktivite yoksa streak'i sıfırla
        if (lastActivity == null || !lastActivity.equals(yesterday)) {
            if (user.getCurrentStreak() > 0) {
                user.setCurrentStreak(0);
                userRepository.save(user);
            }
        }
    }
}
```

### Strateji 3: Login + Background Job (Önerilen)

- **Login endpoint'inde anında güncelle** (sadece giriş yapmak yeterli)
- Background job ile günlük kontrol ve temizlik
- Aktivite bazlı güncelleme artık gerekmez

---

## 📝 Entity Sınıfları

### User Entity Güncellemesi

```java
@Entity
@Table(name = "user")
public class User {
    // ... mevcut alanlar
    
    @Column(name = "current_streak")
    private Integer currentStreak = 0;
    
    @Column(name = "longest_streak")
    private Integer longestStreak = 0;
    
    @Column(name = "last_activity_date")
    private LocalDate lastActivityDate;
    
    // Getters and Setters
    public Integer getCurrentStreak() { return currentStreak; }
    public void setCurrentStreak(Integer currentStreak) { this.currentStreak = currentStreak; }
    
    public Integer getLongestStreak() { return longestStreak; }
    public void setLongestStreak(Integer longestStreak) { this.longestStreak = longestStreak; }
    
    public LocalDate getLastActivityDate() { return lastActivityDate; }
    public void setLastActivityDate(LocalDate lastActivityDate) { this.lastActivityDate = lastActivityDate; }
}
```

### StreakInfo DTO

```java
public class StreakInfo {
    private Integer currentStreak;
    private Integer longestStreak;
    private LocalDate lastActivityDate;
    private Integer daysUntilNextBonus;
    private Integer nextBonusAt;
    private BonusInfo bonusInfo;
    
    // Getters and Setters
    // ...
}

public class BonusInfo {
    private String nextBonus;
    private String reward;
    
    // Getters and Setters
    // ...
}
```

---

## ✅ Test Senaryoları

### Test 1: İlk Aktivite

```bash
# Kullanıcı ilk kez aktivite yapar
POST /api/quiz/submit
{
  "items": [...]
}

# Streak kontrolü
GET /api/users/me
# Response: { "currentStreak": 1, "longestStreak": 1 }
```

### Test 2: Ardışık Günler

```bash
# Gün 1
POST /api/quiz/submit
GET /api/users/me
# Response: { "currentStreak": 1 }

# Gün 2 (ertesi gün)
POST /api/quiz/submit
GET /api/users/me
# Response: { "currentStreak": 2 }

# Gün 3
POST /api/quiz/submit
GET /api/users/me
# Response: { "currentStreak": 3, "bonus": "+20 puan" }
```

### Test 3: Streak Bozulması

```bash
# Gün 1-5: Ardışık aktivite
# Gün 6: Aktivite yok
# Gün 7: Aktivite yapılırsa
POST /api/quiz/submit
GET /api/users/me
# Response: { "currentStreak": 1 } (sıfırlandı)
```

---

## 🎯 Özet

- ✅ User tablosuna `current_streak`, `longest_streak`, `last_activity_date` kolonları eklendi
- ✅ StreakService ile otomatik streak güncelleme
- ✅ Her aktivite sonrası streak kontrolü
- ✅ Background job ile günlük temizlik (opsiyonel)
- ✅ Streak bonusları ve rozet sistemi
- ✅ Frontend'de streak gösterimi için API desteği

---

## 📌 Notlar

1. **Zaman Dilimi:** Streak hesaplaması kullanıcının local timezone'una göre yapılmalı veya UTC kullanılmalı.

2. **Aktivite Tanımı:** Streak için **sadece giriş yapmak yeterlidir**. Herhangi bir aktivite (quiz, pomodoro vb.) yapmaya gerek yoktur.

3. **Günlük Giriş:** Kullanıcı her gün en az bir kez sisteme giriş yapmalıdır. Aynı gün içinde birden fazla giriş yapılsa bile streak sadece 1 kez artar.

4. **Performans:** Tüm kullanıcıların streak'lerini her gün kontrol etmek yerine, sadece aktivite yapan kullanıcıları güncelleyin.

5. **Veri Tutarlılığı:** Background job ile günlük kontrol yaparak veri tutarlılığını sağlayın.

