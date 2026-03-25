# 🎯 Hedef Bilgileri - Backend Kurulum Rehberi

## 📋 Özet

Hedef bilgileri (üniversite, bölüm, sıralama) artık kullanıcıya özel olarak backend'de saklanacak. Her kullanıcının kendi hedef bilgileri olacak.

---

## 🗄️ Database Yapısı

### User Tablosuna Yeni Kolonlar Ekle

```sql
-- User tablosuna hedef bilgileri kolonları ekle
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS hedef_universite VARCHAR(255),
ADD COLUMN IF NOT EXISTS hedef_bolum VARCHAR(255),
ADD COLUMN IF NOT EXISTS hedef_siralama INTEGER DEFAULT 10000;

-- Index ekle (opsiyonel)
CREATE INDEX IF NOT EXISTS idx_user_hedef ON "user"(hedef_universite, hedef_bolum);
```

---

## 📦 Entity Güncellemesi

### User.java

```java
@Entity
@Table(name = "user")
public class User {
    // ... mevcut alanlar ...
    
    @Column(name = "hedef_universite")
    private String hedefUniversite;
    
    @Column(name = "hedef_bolum")
    private String hedefBolum;
    
    @Column(name = "hedef_siralama")
    private Integer hedefSiralama = 10000;
    
    // Getters and Setters
    public String getHedefUniversite() {
        return hedefUniversite;
    }
    
    public void setHedefUniversite(String hedefUniversite) {
        this.hedefUniversite = hedefUniversite;
    }
    
    public String getHedefBolum() {
        return hedefBolum;
    }
    
    public void setHedefBolum(String hedefBolum) {
        this.hedefBolum = hedefBolum;
    }
    
    public Integer getHedefSiralama() {
        return hedefSiralama;
    }
    
    public void setHedefSiralama(Integer hedefSiralama) {
        this.hedefSiralama = hedefSiralama;
    }
}
```

---

## 🔌 API Endpoint Güncellemeleri

### 1. Register Endpoint - Hedef Bilgileri Desteği

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "ad": "Ahmet",
  "soyad": "Yılmaz",
  "password": "password123",
  "sinif": "12",
  "hedefUniversite": "Boğaziçi Üniversitesi",
  "hedefBolum": "Bilgisayar Mühendisliği",
  "hedefSiralama": 10000
}
```

**Controller Örneği:**
```java
@PostMapping("/api/auth/register")
public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
    // ... mevcut kayıt işlemleri ...
    
    User user = new User();
    user.setEmail(request.getEmail());
    user.setAd(request.getAd());
    user.setSoyad(request.getSoyad());
    user.setSinif(request.getSinif());
    
    // Hedef bilgileri
    user.setHedefUniversite(request.getHedefUniversite());
    user.setHedefBolum(request.getHedefBolum());
    user.setHedefSiralama(request.getHedefSiralama() != null ? request.getHedefSiralama() : 10000);
    
    User savedUser = userRepository.save(user);
    
    // ... token oluşturma ve response ...
}
```

---

### 2. User Profile Update Endpoint

**Endpoint:** `PUT /api/users/me`

**Request Body:**
```json
{
  "ad": "Ahmet",
  "soyad": "Yılmaz",
  "email": "user@example.com",
  "hedefUniversite": "Boğaziçi Üniversitesi",
  "hedefBolum": "Bilgisayar Mühendisliği",
  "hedefSiralama": 5000
}
```

**Controller Örneği:**
```java
@PutMapping("/api/users/me")
public ResponseEntity<UserResponse> updateProfile(
    @RequestBody UpdateUserRequest request,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    User currentUser = userRepository.findById(user.getId())
        .orElseThrow(() -> new RuntimeException("User not found"));
    
    // Profil bilgileri
    if (request.getAd() != null) currentUser.setAd(request.getAd());
    if (request.getSoyad() != null) currentUser.setSoyad(request.getSoyad());
    if (request.getEmail() != null) currentUser.setEmail(request.getEmail());
    
    // Hedef bilgileri
    if (request.getHedefUniversite() != null) {
        currentUser.setHedefUniversite(request.getHedefUniversite());
    }
    if (request.getHedefBolum() != null) {
        currentUser.setHedefBolum(request.getHedefBolum());
    }
    if (request.getHedefSiralama() != null) {
        currentUser.setHedefSiralama(request.getHedefSiralama());
    }
    
    User updatedUser = userRepository.save(currentUser);
    return ResponseEntity.ok(UserResponse.from(updatedUser));
}
```

---

### 3. Get Current User Endpoint

**Endpoint:** `GET /api/users/me`

**Response:**
```json
{
  "id": 1,
  "ad": "Ahmet",
  "soyad": "Yılmaz",
  "email": "user@example.com",
  "sinif": "12",
  "hedefUniversite": "Boğaziçi Üniversitesi",
  "hedefBolum": "Bilgisayar Mühendisliği",
  "hedefSiralama": 10000,
  "avatarUrl": "/files/avatars/...",
  "role": "USER"
}
```

**Controller Örneği:**
```java
@GetMapping("/api/users/me")
public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
    User user = (User) authentication.getPrincipal();
    User currentUser = userRepository.findById(user.getId())
        .orElseThrow(() -> new RuntimeException("User not found"));
    
    return ResponseEntity.ok(UserResponse.from(currentUser));
}
```

---

## 📦 DTO Güncellemeleri

### RegisterRequest.java

```java
public class RegisterRequest {
    @NotBlank
    private String email;
    
    @NotBlank
    private String ad;
    
    @NotBlank
    private String soyad;
    
    @NotBlank
    private String password;
    
    private String sinif;
    
    // Hedef bilgileri
    private String hedefUniversite;
    private String hedefBolum;
    private Integer hedefSiralama;
    
    // Getters and Setters
}
```

### UpdateUserRequest.java

```java
public class UpdateUserRequest {
    private String ad;
    private String soyad;
    private String email;
    
    // Hedef bilgileri
    private String hedefUniversite;
    private String hedefBolum;
    private Integer hedefSiralama;
    
    // Getters and Setters
}
```

### UserResponse.java

```java
public class UserResponse {
    private Long id;
    private String ad;
    private String soyad;
    private String email;
    private String sinif;
    private String avatarUrl;
    private String role;
    
    // Hedef bilgileri
    private String hedefUniversite;
    private String hedefBolum;
    private Integer hedefSiralama;
    
    public static UserResponse from(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setAd(user.getAd());
        response.setSoyad(user.getSoyad());
        response.setEmail(user.getEmail());
        response.setSinif(user.getSinif());
        response.setAvatarUrl(user.getAvatarUrl());
        response.setRole(user.getRole().name());
        
        // Hedef bilgileri
        response.setHedefUniversite(user.getHedefUniversite());
        response.setHedefBolum(user.getHedefBolum());
        response.setHedefSiralama(user.getHedefSiralama());
        
        return response;
    }
    
    // Getters and Setters
}
```

---

## 🔒 Güvenlik

- `PUT /api/users/me` endpoint'i sadece authenticated kullanıcılar için
- Kullanıcı sadece kendi hedef bilgilerini güncelleyebilmeli
- `GET /api/users/me` endpoint'i kullanıcının kendi bilgilerini döndürmeli

---

## ✅ Test Senaryoları

1. **Kayıt Sırasında Hedef Bilgileri**
   - ✅ Kayıt formunda hedef bilgileri gönderildiğinde backend'e kaydedilmeli
   - ✅ Kayıt sonrası hedef bilgileri kullanıcıya özel olmalı

2. **Profil Güncelleme**
   - ✅ Hedef bilgileri güncellendiğinde backend'e kaydedilmeli
   - ✅ Güncelleme sonrası yeni bilgiler görünmeli

3. **Kullanıcıya Özel**
   - ✅ Kullanıcı A'nın hedef bilgileri, Kullanıcı B'yi etkilememeli
   - ✅ Her kullanıcı kendi hedef bilgilerini görmeli

4. **Backend Bağlantısı Yok**
   - ✅ Frontend fallback olarak localStorage kullanmalı (kullanıcı ID'si ile)
   - ✅ Backend bağlantısı kurulduğunda otomatik senkronize olmalı

---

## 🚀 Kurulum Adımları

1. **Database Migration**
   ```sql
   -- Yukarıdaki ALTER TABLE komutunu çalıştırın
   ```

2. **Entity Güncelle**
   - `User.java` entity'sine hedef alanları ekle

3. **DTO'ları Güncelle**
   - `RegisterRequest.java` - hedef alanları ekle
   - `UpdateUserRequest.java` - hedef alanları ekle
   - `UserResponse.java` - hedef alanları ekle

4. **Controller'ları Güncelle**
   - `AuthController.java` - register endpoint'ine hedef desteği ekle
   - `UserController.java` - update ve get endpoint'lerine hedef desteği ekle

5. **Test Et**
   - Kayıt sırasında hedef bilgileri gönder
   - Profil güncelleme ile hedef bilgileri güncelle
   - Farklı kullanıcılarla test et

---

## 📝 Notlar

- Frontend, backend bağlantısı yoksa localStorage kullanıyor (fallback)
- LocalStorage key'i: `userHedef_{userId}` formatında (kullanıcıya özel)
- Backend hazır olduğunda, frontend otomatik olarak backend'i kullanacak
- Eski localStorage verileri (`userHedef`) yeni formata (`userHedef_{userId}`) migrate edilebilir

---

## 🔗 İlgili Dosyalar

- **Frontend:** 
  - `src/Dashboard.jsx` - Hedef bilgileri gösterimi ve kaydetme
  - `src/Profilim.jsx` - Hedef bilgileri düzenleme
  - `src/AuthPage.jsx` - Kayıt sırasında hedef bilgileri

- **Backend:** 
  - `User.java` - Entity güncellemesi
  - `AuthController.java` - Register endpoint
  - `UserController.java` - Update ve Get endpoint'leri
  - `RegisterRequest.java`, `UpdateUserRequest.java`, `UserResponse.java` - DTO'lar











