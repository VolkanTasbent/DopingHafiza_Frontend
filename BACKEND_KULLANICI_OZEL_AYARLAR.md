# 👤 Kullanıcıya Özel Ayarlar - Backend Kurulum Rehberi

## 📋 Özet

Kullanıcıya özel ayarlar (dark mode, aktiviteler vb.) için backend'de aşağıdaki değişiklikler gereklidir.

---

## 🗄️ Database Yapısı

### 1. User Tablosuna Dark Mode Kolonu Ekle

```sql
-- User tablosuna dark_mode kolonu ekle
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false;

-- Index ekle (opsiyonel)
CREATE INDEX IF NOT EXISTS idx_user_dark_mode ON "user"(dark_mode);
```

---

## 🔌 API Endpoint Güncellemeleri

### 1. Kullanıcı Bilgilerini Getir - Dark Mode Desteği

**Endpoint:** `GET /api/users/me`

**Response (Güncellenmiş):**
```json
{
  "id": 1,
  "ad": "Ahmet",
  "soyad": "Yılmaz",
  "email": "ahmet@example.com",
  "puan": 2938,
  "darkMode": true,
  "hedefUniversite": "Marmara Üniversitesi",
  "hedefBolum": "Bilgisayar Mühendisliği",
  "hedefSiralama": 10000
}
```

**Controller Örneği (Java Spring Boot):**
```java
@GetMapping("/api/users/me")
public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
    User user = (User) authentication.getPrincipal();
    
    UserResponse response = UserResponse.from(user);
    response.setDarkMode(user.getDarkMode() != null ? user.getDarkMode() : false);
    
    return ResponseEntity.ok(response);
}
```

---

### 2. Kullanıcı Ayarlarını Güncelle - Dark Mode

**Endpoint:** `PUT /api/users/me`

**Request Body:**
```json
{
  "darkMode": true
}
```

**Veya tüm ayarlar birlikte:**
```json
{
  "darkMode": true,
  "hedefUniversite": "Marmara Üniversitesi",
  "hedefBolum": "Bilgisayar Mühendisliği",
  "hedefSiralama": 10000
}
```

**Response:**
```json
{
  "id": 1,
  "ad": "Ahmet",
  "soyad": "Yılmaz",
  "email": "ahmet@example.com",
  "darkMode": true
}
```

**Controller Örneği:**
```java
@PutMapping("/api/users/me")
public ResponseEntity<UserResponse> updateCurrentUser(
    @RequestBody UpdateUserRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    // Dark mode güncelle
    if (request.getDarkMode() != null) {
        user.setDarkMode(request.getDarkMode());
    }
    
    // Diğer alanları güncelle
    if (request.getHedefUniversite() != null) {
        user.setHedefUniversite(request.getHedefUniversite());
    }
    if (request.getHedefBolum() != null) {
        user.setHedefBolum(request.getHedefBolum());
    }
    if (request.getHedefSiralama() != null) {
        user.setHedefSiralama(request.getHedefSiralama());
    }
    
    User updated = userRepository.save(user);
    
    return ResponseEntity.ok(UserResponse.from(updated));
}
```

---

### 3. Son Aktiviteleri Getir - Kullanıcıya Özel

**Endpoint:** `GET /api/activities/recent`

**Query Parameters:**
- `limit` (optional): Son kaç aktivite getirilecek (default: 20, max: 50)

**Response:**
```json
{
  "activities": [
    {
      "id": 123,
      "activityType": "soru_cozme",
      "activityTitle": "TYT Tarih > Tarih ve Zaman",
      "activitySubtitle": "15 doğru, 3 yanlış",
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
      "activityTitle": "TYT Fizik > Fizik Bilimine Giriş - Konu Anlatım Videosu",
      "activitySubtitle": "Fizik ve Ölçme",
      "activityIcon": "video",
      "dersId": 3,
      "konuId": 8,
      "createdAt": "2025-01-15T13:20:00Z"
    },
    {
      "id": 121,
      "activityType": "konu_calisma",
      "activityTitle": "TYT Matematik > Fonksiyonlar - Konu Anlatım Dökümanı",
      "activitySubtitle": "Fonksiyonlar ve Grafikleri",
      "activityIcon": "book",
      "dersId": 2,
      "konuId": 5,
      "createdAt": "2025-01-15T12:10:00Z"
    }
  ]
}
```

**ÖNEMLİ:** Bu endpoint zaten mevcut olmalı ve sadece authenticated kullanıcının kendi aktivitelerini döndürmeli. `user_activity` tablosundan `user_id` ile filtreleme yapılmalı.

---

## 📦 Entity Güncellemeleri

### User.java

```java
@Entity
@Table(name = "user")
public class User {
    // ... mevcut alanlar ...
    
    @Column(name = "dark_mode")
    private Boolean darkMode = false;
    
    // Getters and Setters
    public Boolean getDarkMode() {
        return darkMode != null ? darkMode : false;
    }
    
    public void setDarkMode(Boolean darkMode) {
        this.darkMode = darkMode;
    }
}
```

---

### Request DTO: UpdateUserRequest.java

```java
public class UpdateUserRequest {
    private Boolean darkMode;
    private String hedefUniversite;
    private String hedefBolum;
    private Integer hedefSiralama;
    
    // Getters and Setters
}
```

---

### Response DTO: UserResponse.java

```java
public class UserResponse {
    private Long id;
    private String ad;
    private String soyad;
    private String email;
    private Integer puan;
    private Boolean darkMode;
    private String hedefUniversite;
    private String hedefBolum;
    private Integer hedefSiralama;
    
    public static UserResponse from(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setAd(user.getAd());
        response.setSoyad(user.getSoyad());
        response.setEmail(user.getEmail());
        response.setPuan(user.getPuan());
        response.setDarkMode(user.getDarkMode() != null ? user.getDarkMode() : false);
        response.setHedefUniversite(user.getHedefUniversite());
        response.setHedefBolum(user.getHedefBolum());
        response.setHedefSiralama(user.getHedefSiralama());
        return response;
    }
    
    // Getters and Setters
}
```

---

## 🔄 Mevcut Endpoint Kontrolleri

### 1. `/api/activities/recent` Endpoint Kontrolü

Bu endpoint'in kullanıcıya özel çalıştığından emin olun:

```java
@GetMapping("/api/activities/recent")
public ResponseEntity<RecentActivitiesResponse> getRecentActivities(
    @RequestParam(defaultValue = "20") int limit,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    // ÖNEMLİ: Sadece kullanıcının kendi aktivitelerini getir
    List<UserActivity> activities = userActivityRepository
        .findByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(0, Math.min(limit, 50)));
    
    // ... response oluştur ...
}
```

### 2. `/api/activities` (POST) Endpoint Kontrolü

Aktivite kaydedilirken kullanıcı ID'sinin otomatik eklenmesi:

```java
@PostMapping("/api/activities")
public ResponseEntity<ActivityResponse> createActivity(
    @RequestBody CreateActivityRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    UserActivity activity = new UserActivity();
    activity.setUserId(user.getId()); // ÖNEMLİ: Kullanıcı ID'si otomatik eklenmeli
    // ... diğer alanlar ...
    
    UserActivity saved = userActivityRepository.save(activity);
    return ResponseEntity.ok(ActivityResponse.from(saved));
}
```

---

## ✅ Test Senaryoları

1. **Dark Mode Kaydet ve Yükle**
   - ✅ Kullanıcı dark mode'u açtığında backend'e kaydedilmeli
   - ✅ Kullanıcı giriş yaptığında dark mode ayarı yüklenmeli
   - ✅ Farklı kullanıcılar farklı dark mode ayarlarına sahip olmalı

2. **Aktiviteler Kullanıcıya Özel**
   - ✅ Her kullanıcı sadece kendi aktivitelerini görmeli
   - ✅ Aktivite kaydedilirken kullanıcı ID'si otomatik eklenmeli
   - ✅ `/api/activities/recent` endpoint'i sadece authenticated kullanıcının aktivitelerini döndürmeli

3. **Çoklu Kullanıcı Desteği**
   - ✅ Kullanıcı A'nın aktiviteleri Kullanıcı B'de görünmemeli
   - ✅ Kullanıcı A'nın dark mode ayarı Kullanıcı B'yi etkilememeli

---

## 🚀 Kurulum Adımları

1. **Database Migration**
   ```sql
   -- User tablosuna dark_mode kolonu ekle
   ALTER TABLE "user" ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false;
   ```

2. **Entity Güncelle**
   - `User.java` entity'sine `darkMode` alanı ekle

3. **DTO'ları Güncelle**
   - `UpdateUserRequest.java` - `darkMode` alanı ekle
   - `UserResponse.java` - `darkMode` alanı ekle

4. **Controller Güncelle**
   - `GET /api/users/me` - Dark mode bilgisini döndür
   - `PUT /api/users/me` - Dark mode güncelleme desteği ekle

5. **Aktivite Endpoint'lerini Kontrol Et**
   - `/api/activities/recent` - Kullanıcıya özel filtreleme yapıldığından emin ol
   - `/api/activities` (POST) - Kullanıcı ID'si otomatik ekleniyor mu kontrol et

6. **Test Et**
   - Farklı kullanıcılarla test et
   - Dark mode ayarının kullanıcıya özel olduğunu doğrula
   - Aktivitelerin kullanıcıya özel olduğunu doğrula

---

## 📝 Notlar

- **Frontend Fallback:** Backend yoksa frontend localStorage'da kullanıcıya özel saklıyor (`darkMode_${userId}`, `videoActivities_${userId}` vb.)
- **Güvenlik:** Tüm endpoint'lerde authentication kontrolü yapılmalı
- **Performans:** Aktivite sorgularında index kullanımı önemli
- **Veri Tutarlılığı:** Aktivite kaydedilirken `user_id` her zaman set edilmeli

---

## 🔗 İlgili Dosyalar

- **Frontend:** 
  - `src/App.jsx` (Dark mode yönetimi)
  - `src/Dashboard.jsx` (Aktivite yükleme - kullanıcıya özel)
  - `src/DersDetay.jsx` (Video/PDF aktivite kaydı - kullanıcıya özel)
  - `src/SoruCoz.jsx` (Quiz aktivite kaydı - kullanıcıya özel)
- **Backend:** 
  - User entity ve repository
  - Activity entity ve repository
  - UserController
  - ActivityController

