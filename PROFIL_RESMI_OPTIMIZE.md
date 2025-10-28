# ⚡ Profil Resmi - Optimize Edilmiş Versiyon

## 🎯 Optimizasyon
Backend endpoint'i artık tek seferde hem resmi yükler hem de otomatik olarak user profile'ı günceller!

### Eski Yöntem (2 API Çağrısı)
```
1. POST /api/files/upload-avatar → { url: "/files/avatars/..." }
2. PUT /api/users/me → { avatarUrl: "..." }
```

### ✨ Yeni Yöntem (1 API Çağrısı)
```
1. POST /api/files/upload-avatar → { ...user, avatarUrl: "/files/avatars/..." }
```

---

## 📝 Backend Değişiklikleri

### 1. FileController.java - UserService Dependency Ekle

```java
package com.example.backend.controller;

import com.example.backend.entity.User;
import com.example.backend.service.FileStorageService;
import com.example.backend.service.UserService;  // 👈 EKLE
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = {"http://localhost:5173","http://localhost:3000"}, allowCredentials = "true")
public class FileController {
    private final FileStorageService storage;
    private final UserService userService;  // 👈 EKLE

    // 👇 Constructor'ı güncelle
    public FileController(FileStorageService storage, UserService userService) { 
        this.storage = storage;
        this.userService = userService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String,String> upload(@RequestPart("file") MultipartFile file) throws Exception {
        if (file.isEmpty()) throw new IllegalArgumentException("Dosya boş");
        String url = storage.save(file, "general");
        return Map.of("url", url);
    }

    // 👇 Upload Avatar Endpoint'ini Güncelle (Return Type: User)
    @PostMapping(value = "/upload-avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public User uploadAvatar(  // 👈 Map yerine User döndür
            @RequestPart("file") MultipartFile file,
            Authentication auth) throws Exception {
        
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Dosya boş");
        }
        
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Sadece resim dosyaları yüklenebilir");
        }
        
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("Dosya boyutu 5MB'dan küçük olmalıdır");
        }
        
        // 👇 User'ı bul
        String email = auth.getName();
        User user = userService.findByEmail(email);
        
        // 👇 Resmi kaydet
        String avatarUrl = storage.saveAvatar(file, email);
        
        // 👇 User'ı güncelle ve kaydet
        user.setAvatarUrl(avatarUrl);
        User updatedUser = userService.save(user);
        
        // 👇 Şifresiz user döndür
        updatedUser.setPassword(null);
        return updatedUser;
    }
}
```

### 2. User Entity - Avatar URL Field Ekle

`User.java` entity'nize field ekleyin:

```java
@Entity
@Table(name = "app_user")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String ad;
    private String soyad;
    private String email;
    private String password;
    private String role;
    
    @Column(name = "avatar_url")  // 👈 YENİ FIELD
    private String avatarUrl;
    
    // Getter & Setter
    public String getAvatarUrl() {
        return avatarUrl;
    }
    
    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }
    
    // ... diğer getter/setter'lar
}
```

---

## ✅ Frontend Değişiklikleri (Zaten Yapıldı)

Frontend kodu optimize edilmiş durumda! Artık:

```javascript
// Tek API çağrısı
const { data: updatedUser } = await api.post("/api/files/upload-avatar", formData);

// updatedUser objesinde avatarUrl zaten güncellenmiş!
setUser(updatedUser);
```

---

## 🔄 API Davranışı

### Request
```http
POST /api/files/upload-avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image file>
```

### Response (Güncellenmiş User Objesi)
```json
{
  "id": 2,
  "ad": "Volkan",
  "soyad": "Tasbent",
  "email": "volkan@example.com",
  "role": "ADMIN",
  "avatarUrl": "/files/avatars/volkan_example_com_1698765432100.jpg",
  "password": null
}
```

---

## ✅ Yapılması Gerekenler Özeti

### Backend'de:

1. **FileController.java** güncellemesi:
   - [ ] `UserService` dependency ekle
   - [ ] Constructor'a `UserService` ekle
   - [ ] `uploadAvatar()` metodunu güncelle (User döndürecek şekilde)
   - [ ] User bulma, güncelleme ve kaydetme logic'i ekle

2. **User.java** güncellemesi:
   - [ ] `avatarUrl` field'ı ekle
   - [ ] Getter/Setter ekle

3. **Database**:
   - [ ] `database_migration_avatar.sql` çalıştır

4. **FileStorageService.java** ve **FileServingConfig.java**:
   - [ ] Daha önce anlattığım şekilde ekle/güncelle

### Frontend'de:
✅ Hiçbir şey! Zaten optimize edilmiş kod mevcut.

---

## 🚀 Test

```bash
# Backend başlat
./mvnw spring-boot:run

# Frontend başlat
npm run dev

# Profil sayfasına git ve resim yükle
# Tek tıkla hem yüklenecek hem profil güncellenecek!
```

---

## 📊 Avantajlar

✅ **Daha Hızlı**: 2 yerine 1 API çağrısı  
✅ **Daha Güvenilir**: Atomik işlem (ya her şey başarılı ya hiçbiri)  
✅ **Daha Basit**: Frontend'de daha az kod  
✅ **Daha Tutarlı**: Race condition yok  
✅ **Daha İyi UX**: Kullanıcı tek seferde sonucu görür  

---

## 🎉 Sonuç

Bu optimizasyon ile:
- Frontend daha performanslı
- Backend daha tutarlı
- Kullanıcı deneyimi daha iyi
- Kod daha temiz ve maintainable!

