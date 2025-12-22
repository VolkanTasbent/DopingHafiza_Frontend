# 🎯 Kullanıcı Puan Hesaplama Sistemi - Backend Kurulum Rehberi

## 📋 Özet

Kullanıcı puanları artık herkese aynı değil, her kullanıcının performansına göre dinamik olarak hesaplanacak. Puan hesaplama sistemi şu faktörlere göre çalışır:
- Doğru cevap sayısı
- Yanlış cevap sayısı
- Toplam çözülen soru sayısı
- Net puan (doğru - yanlış/4)
- Zaman bonusları
- Streak bonusları
- Günlük aktivite bonusları

---

## 🎯 Puan Hesaplama Formülü

### Temel Formül

```
Toplam Puan = (Doğru Cevap Puanı) + (Net Puan Bonusu) + (Aktivite Bonusları) + (Streak Bonusları)
```

### Detaylı Hesaplama

1. **Temel Puan:**
   - Her doğru cevap: **10 puan**
   - Her yanlış cevap: **-2.5 puan** (net puan hesaplaması için)
   - Her boş cevap: **0 puan**

2. **Net Puan Bonusu:**
   - Net = Doğru - (Yanlış / 4)
   - Net puan bonusu = Net × 5

3. **Aktivite Bonusları:**
   - Günlük 30+ soru çözme: **+50 puan**
   - Günlük 50+ soru çözme: **+100 puan**
   - Günlük 100+ soru çözme: **+200 puan**
   - Haftalık 200+ soru çözme: **+300 puan**

4. **Streak Bonusları:**
   - 3 günlük streak: **+20 puan**
   - 7 günlük streak: **+50 puan**
   - 30 günlük streak: **+200 puan**

5. **Doğruluk Oranı Bonusu:**
   - %80+ doğruluk: **+30 puan**
   - %90+ doğruluk: **+50 puan**
   - %95+ doğruluk: **+100 puan**

---

## 🗄️ Database Yapısı

### Mevcut Tablolar

Puan hesaplaması için `rapor` tablosundaki veriler kullanılacak:

```sql
-- Rapor tablosu (zaten mevcut olmalı)
SELECT 
  user_id,
  COUNT(*) as total_rapor,
  SUM(correct_count) as total_dogru,
  SUM(wrong_count) as total_yanlis,
  SUM(empty_count) as total_bos,
  SUM(net) as total_net,
  MAX(finished_at) as son_aktivite
FROM rapor
WHERE user_id = ?
GROUP BY user_id;
```

### Kullanıcı Tablosuna Puan Kolonu

Eğer `user` tablosunda `puan` kolonu yoksa:

```sql
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS puan INTEGER DEFAULT 0;

-- Index ekle (sıralama için)
CREATE INDEX IF NOT EXISTS idx_user_puan ON "user"(puan DESC);
```

---

## 🔌 API Endpoint'leri

### 1. Kullanıcı Puanını Hesapla ve Güncelle

**Endpoint:** `POST /api/users/calculate-score` veya `PUT /api/users/me/score`

**Açıklama:** Kullanıcının mevcut raporlarına göre puanını hesaplar ve günceller.

**Response:**
```json
{
  "userId": 1,
  "oldScore": 2938,
  "newScore": 4520,
  "breakdown": {
    "baseScore": 3000,
    "netBonus": 1200,
    "activityBonus": 200,
    "streakBonus": 120,
    "accuracyBonus": 0
  },
  "stats": {
    "totalCorrect": 300,
    "totalWrong": 50,
    "totalEmpty": 20,
    "totalNet": 287.5,
    "accuracy": 0.81,
    "totalReports": 45
  }
}
```

**Controller Örneği (Java Spring Boot):**

```java
@PostMapping("/api/users/calculate-score")
public ResponseEntity<ScoreCalculationResponse> calculateUserScore(
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    // Kullanıcının tüm raporlarını al
    List<Rapor> raporlar = raporRepository.findByUserId(user.getId());
    
    // İstatistikleri hesapla
    int totalCorrect = raporlar.stream()
        .mapToInt(Rapor::getCorrectCount)
        .sum();
    
    int totalWrong = raporlar.stream()
        .mapToInt(Rapor::getWrongCount)
        .sum();
    
    int totalEmpty = raporlar.stream()
        .mapToInt(Rapor::getEmptyCount)
        .sum();
    
    double totalNet = raporlar.stream()
        .mapToDouble(Rapor::getNet)
        .sum();
    
    int totalReports = raporlar.size();
    
    // Doğruluk oranı
    int totalAnswered = totalCorrect + totalWrong;
    double accuracy = totalAnswered > 0 
        ? (double) totalCorrect / totalAnswered 
        : 0.0;
    
    // Puan hesaplama
    ScoreCalculation calculation = calculateScore(
        totalCorrect, 
        totalWrong, 
        totalEmpty, 
        totalNet,
        totalReports,
        accuracy,
        user.getId()
    );
    
    // Kullanıcı puanını güncelle
    int oldScore = user.getPuan() != null ? user.getPuan() : 0;
    user.setPuan(calculation.getTotalScore());
    userRepository.save(user);
    
    // Response oluştur
    ScoreCalculationResponse response = new ScoreCalculationResponse();
    response.setUserId(user.getId());
    response.setOldScore(oldScore);
    response.setNewScore(calculation.getTotalScore());
    response.setBreakdown(calculation.getBreakdown());
    response.setStats(new UserStats(
        totalCorrect, totalWrong, totalEmpty, 
        totalNet, accuracy, totalReports
    ));
    
    return ResponseEntity.ok(response);
}

// Puan hesaplama metodu
private ScoreCalculation calculateScore(
    int totalCorrect,
    int totalWrong,
    int totalEmpty,
    double totalNet,
    int totalReports,
    double accuracy,
    Long userId
) {
    ScoreCalculation calc = new ScoreCalculation();
    
    // 1. Temel Puan
    int baseScore = (totalCorrect * 10) - (int)(totalWrong * 2.5);
    calc.setBaseScore(baseScore);
    
    // 2. Net Puan Bonusu
    int netBonus = (int)(totalNet * 5);
    calc.setNetBonus(netBonus);
    
    // 3. Aktivite Bonusları
    int activityBonus = 0;
    if (totalReports >= 100) {
        activityBonus += 200;
    } else if (totalReports >= 50) {
        activityBonus += 100;
    } else if (totalReports >= 30) {
        activityBonus += 50;
    }
    
    // Günlük aktivite kontrolü (son 7 gün)
    long dailyActivity = getDailyActivityCount(userId, 7);
    if (dailyActivity >= 100) {
        activityBonus += 200;
    } else if (dailyActivity >= 50) {
        activityBonus += 100;
    } else if (dailyActivity >= 30) {
        activityBonus += 50;
    }
    
    calc.setActivityBonus(activityBonus);
    
    // 4. Streak Bonusu
    int streakDays = getCurrentStreak(userId);
    int streakBonus = 0;
    if (streakDays >= 30) {
        streakBonus = 200;
    } else if (streakDays >= 7) {
        streakBonus = 50;
    } else if (streakDays >= 3) {
        streakBonus = 20;
    }
    calc.setStreakBonus(streakBonus);
    
    // 5. Doğruluk Oranı Bonusu
    int accuracyBonus = 0;
    if (accuracy >= 0.95) {
        accuracyBonus = 100;
    } else if (accuracy >= 0.90) {
        accuracyBonus = 50;
    } else if (accuracy >= 0.80) {
        accuracyBonus = 30;
    }
    calc.setAccuracyBonus(accuracyBonus);
    
    // Toplam puan
    int totalScore = baseScore + netBonus + activityBonus + streakBonus + accuracyBonus;
    calc.setTotalScore(Math.max(0, totalScore)); // Negatif puan olmasın
    
    return calc;
}

// Streak hesaplama (yardımcı metod)
private int getCurrentStreak(Long userId) {
    // Son aktivite tarihini al
    Optional<Rapor> lastReport = raporRepository
        .findTopByUserIdOrderByFinishedAtDesc(userId);
    
    if (lastReport.isEmpty()) {
        return 0;
    }
    
    LocalDate lastDate = lastReport.get().getFinishedAt()
        .toInstant()
        .atZone(ZoneId.systemDefault())
        .toLocalDate();
    
    LocalDate today = LocalDate.now();
    
    // Eğer bugün aktivite yoksa streak 0
    if (!lastDate.equals(today) && !lastDate.equals(today.minusDays(1))) {
        return 0;
    }
    
    // Ardışık günleri say
    int streak = 0;
    LocalDate checkDate = today;
    
    while (true) {
        LocalDate finalCheckDate = checkDate;
        boolean hasActivity = raporRepository.existsByUserIdAndFinishedAtBetween(
            userId,
            finalCheckDate.atStartOfDay(),
            finalCheckDate.atTime(23, 59, 59)
        );
        
        if (hasActivity) {
            streak++;
            checkDate = checkDate.minusDays(1);
        } else {
            break;
        }
    }
    
    return streak;
}

// Günlük aktivite sayısı (yardımcı metod)
private long getDailyActivityCount(Long userId, int days) {
    LocalDate startDate = LocalDate.now().minusDays(days);
    return raporRepository.countByUserIdAndFinishedAtAfter(
        userId,
        startDate.atStartOfDay()
    );
}
```

---

### 2. Kullanıcı Puanını Getir (Otomatik Hesaplama ile)

**Endpoint:** `GET /api/users/me`

**Açıklama:** Kullanıcı bilgilerini getirirken puanı otomatik hesaplar ve günceller.

**Response:**
```json
{
  "id": 1,
  "ad": "Ahmet",
  "soyad": "Yılmaz",
  "email": "ahmet@example.com",
  "puan": 4520,
  "hedefUniversite": "Marmara Üniversitesi",
  "hedefBolum": "Bilgisayar Mühendisliği"
}
```

**Controller Güncellemesi:**

```java
@GetMapping("/api/users/me")
public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
    User user = (User) authentication.getPrincipal();
    
    // Puanı otomatik hesapla ve güncelle (her istekte değil, belirli aralıklarla)
    // Örnek: Son güncelleme 1 saatten eskiyse yeniden hesapla
    if (shouldRecalculateScore(user)) {
        calculateAndUpdateScore(user);
    }
    
    UserResponse response = UserResponse.from(user);
    return ResponseEntity.ok(response);
}

private boolean shouldRecalculateScore(User user) {
    // Son puan güncelleme zamanını kontrol et
    // Bu bilgiyi user tablosuna ekleyebilirsiniz veya cache kullanabilirsiniz
    // Şimdilik her seferinde hesaplayalım (performans için cache eklenebilir)
    return true;
}

private void calculateAndUpdateScore(User user) {
    // calculateScore metodunu çağır
    List<Rapor> raporlar = raporRepository.findByUserId(user.getId());
    // ... hesaplama mantığı
    // user.setPuan(calculatedScore);
    // userRepository.save(user);
}
```

---

### 3. Tüm Kullanıcıların Puanlarını Güncelle (Admin/Background Job)

**Endpoint:** `POST /api/admin/recalculate-all-scores`

**Açıklama:** Tüm kullanıcıların puanlarını yeniden hesaplar. Admin veya background job için.

**Controller:**

```java
@PostMapping("/api/admin/recalculate-all-scores")
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<Map<String, Object>> recalculateAllScores() {
    List<User> users = userRepository.findAll();
    int updated = 0;
    
    for (User user : users) {
        try {
            calculateAndUpdateScore(user);
            updated++;
        } catch (Exception e) {
            log.error("Kullanıcı puanı hesaplanamadı: {}", user.getId(), e);
        }
    }
    
    Map<String, Object> response = new HashMap<>();
    response.put("totalUsers", users.size());
    response.put("updated", updated);
    response.put("message", "Puanlar başarıyla güncellendi");
    
    return ResponseEntity.ok(response);
}
```

---

## 📊 Puan Hesaplama Örnekleri

### Örnek 1: Yeni Kullanıcı

- Doğru: 0
- Yanlış: 0
- Boş: 0
- Net: 0
- Streak: 0
- **Toplam Puan: 0**

### Örnek 2: Orta Seviye Kullanıcı

- Doğru: 200
- Yanlış: 50
- Boş: 20
- Net: 187.5 (200 - 50/4)
- Streak: 5 gün
- Doğruluk: %80
- Toplam Rapor: 30

**Hesaplama:**
- Temel Puan: (200 × 10) - (50 × 2.5) = 2000 - 125 = **1875**
- Net Bonus: 187.5 × 5 = **937.5**
- Aktivite Bonusu: 30+ rapor = **+50**
- Streak Bonusu: 3+ gün = **+20**
- Doğruluk Bonusu: %80+ = **+30**
- **Toplam: 2912.5 ≈ 2913 puan**

### Örnek 3: İleri Seviye Kullanıcı

- Doğru: 1000
- Yanlış: 100
- Boş: 50
- Net: 975 (1000 - 100/4)
- Streak: 30 gün
- Doğruluk: %91
- Toplam Rapor: 150

**Hesaplama:**
- Temel Puan: (1000 × 10) - (100 × 2.5) = 10000 - 250 = **9750**
- Net Bonus: 975 × 5 = **4875**
- Aktivite Bonusu: 100+ rapor = **+200**
- Streak Bonusu: 30+ gün = **+200**
- Doğruluk Bonusu: %90+ = **+50**
- **Toplam: 15075 puan**

---

## 🔄 Otomatik Puan Güncelleme Stratejileri

### Strateji 1: Her Rapor Sonrası Güncelle

Her quiz/deneme sınavı sonrası puanı güncelle:

```java
@PostMapping("/api/raporlar")
public ResponseEntity<RaporResponse> createRapor(
    @RequestBody RaporRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    // Raporu kaydet
    Rapor rapor = new Rapor();
    // ... rapor bilgilerini set et
    Rapor saved = raporRepository.save(rapor);
    
    // Puanı güncelle
    calculateAndUpdateScore(user);
    
    return ResponseEntity.ok(RaporResponse.from(saved));
}
```

### Strateji 2: Zamanlanmış Güncelleme (Background Job)

Her saat başı veya günde bir kez tüm kullanıcıların puanlarını güncelle:

```java
@Scheduled(cron = "0 0 * * * *") // Her saat başı
public void updateAllScores() {
    List<User> users = userRepository.findAll();
    for (User user : users) {
        calculateAndUpdateScore(user);
    }
}
```

### Strateji 3: Cache ile Performans İyileştirme

Puan hesaplamasını cache'leyerek performansı artır:

```java
@Cacheable(value = "userScores", key = "#userId")
public int getUserScore(Long userId) {
    User user = userRepository.findById(userId).orElseThrow();
    return calculateScore(user).getTotalScore();
}
```

---

## ✅ Test Senaryoları

### Test 1: Yeni Kullanıcı Puanı

```bash
# Yeni kullanıcı oluştur
POST /api/auth/register
{
  "email": "test@example.com",
  "password": "123456",
  "ad": "Test",
  "soyad": "User"
}

# Puanı kontrol et (0 olmalı)
GET /api/users/me
# Response: { "puan": 0 }
```

### Test 2: Soru Çözme Sonrası Puan Güncelleme

```bash
# Quiz çöz
POST /api/raporlar
{
  "correctCount": 10,
  "wrongCount": 2,
  "emptyCount": 0,
  "net": 9.5
}

# Puanı kontrol et
GET /api/users/me
# Response: { "puan": 95 } (10×10 - 2×2.5 + 9.5×5 = 100 - 5 + 47.5 = 142.5 ≈ 143)
```

### Test 3: Puan Hesaplama Endpoint'i

```bash
# Puanı manuel hesapla
POST /api/users/calculate-score

# Response:
{
  "userId": 1,
  "oldScore": 2938,
  "newScore": 4520,
  "breakdown": {
    "baseScore": 3000,
    "netBonus": 1200,
    "activityBonus": 200,
    "streakBonus": 120,
    "accuracyBonus": 0
  }
}
```

---

## 📝 Notlar

1. **Performans:** Tüm kullanıcıların puanlarını her istekte hesaplamak performans sorunu yaratabilir. Cache kullanın veya background job ile güncelleyin.

2. **Negatif Puan:** Puan hesaplamasında `Math.max(0, totalScore)` kullanarak negatif puanları engelleyin.

3. **Yuvarlama:** Puanları integer olarak saklayın, hesaplamalarda double kullanabilirsiniz.

4. **Güvenlik:** Puan hesaplama endpoint'leri sadece authenticated kullanıcılar için olmalı.

5. **Veri Tutarlılığı:** Rapor silindiğinde veya güncellendiğinde puanı yeniden hesaplayın.

---

## 🎯 Özet

- ✅ Her kullanıcının puanı kendi performansına göre hesaplanır
- ✅ Doğru cevap, net puan, aktivite, streak ve doğruluk bonusları dahil
- ✅ Otomatik güncelleme mekanizması
- ✅ Performans için cache ve background job desteği
- ✅ Admin için toplu güncelleme endpoint'i






