# Backend Profil Resmi Kurulum Talimatları

Bu dosya, profil resmi yükleme özelliğini backend'inize eklemek için gerekli adımları içermektedir.

## 📋 İçindekiler
1. Database Migration
2. FileController Güncelleme
3. FileStorageService Güncelleme
4. Static File Serving Configuration
5. Test

---

## 1. Database Migration

`app_user` tablosuna `avatar_url` kolonu ekleyin:

```sql
-- database_migration_avatar.sql dosyasını kullanın
ALTER TABLE app_user 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN app_user.avatar_url IS 'Kullanıcının profil resmi URL yolu';
```

---

## 2. FileController Güncelleme

`src/main/java/com/example/backend/controller/FileController.java` dosyasını güncelleyin:

```java
package com.example.backend.controller;

import com.example.backend.entity.User;
import com.example.backend.service.FileStorageService;
import com.example.backend.service.UserService;
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
    private final UserService userService;

    public FileController(FileStorageService storage, UserService userService) { 
        this.storage = storage;
        this.userService = userService;
    }

    /**
     * Genel dosya yükleme (sadece ADMIN)
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String,String> upload(@RequestPart("file") MultipartFile file) throws Exception {
        if (file.isEmpty()) throw new IllegalArgumentException("Dosya boş");
        String url = storage.save(file, "general");
        return Map.of("url", url);
    }

    /**
     * Profil resmi yükleme - Otomatik olarak user profile'ı günceller ve döner
     * Bu sayede frontend tek API çağrısıyla hem yükleme hem güncelleme yapar
     */
    @PostMapping(value = "/upload-avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public User uploadAvatar(
            @RequestPart("file") MultipartFile file,
            Authentication auth) throws Exception {
        
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Dosya boş");
        }
        
        // Dosya tipi kontrolü
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Sadece resim dosyaları yüklenebilir");
        }
        
        // Dosya boyutu kontrolü (max 5MB)
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("Dosya boyutu 5MB'dan küçük olmalıdır");
        }
        
        // Kullanıcıyı bul
        String email = auth.getName();
        User user = userService.findByEmail(email);
        
        // Profil resmi kaydet
        String avatarUrl = storage.saveAvatar(file, email);
        
        // User'ın avatar_url'ini güncelle
        user.setAvatarUrl(avatarUrl);
        User updatedUser = userService.save(user);
        
        // Güncellenmiş user objesini döndür (şifre olmadan)
        updatedUser.setPassword(null);
        return updatedUser;
    }
}
```

---

## 3. FileStorageService Güncelleme

`src/main/java/com/example/backend/service/FileStorageService.java` dosyasını güncelleyin:

```java
package com.example.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.UUID;

@Service
public class FileStorageService {
    private final Path root = Paths.get("./uploads").toAbsolutePath().normalize();
    private final Path avatarRoot = root.resolve("avatars");

    public FileStorageService() throws IOException {
        Files.createDirectories(root);
        Files.createDirectories(avatarRoot);
    }

    /**
     * Genel dosya kaydetme
     */
    public String save(MultipartFile file, String folder) throws IOException {
        Path targetDir = root.resolve(folder);
        Files.createDirectories(targetDir);
        
        String ext = getFileExtension(file.getOriginalFilename());
        String name = UUID.randomUUID().toString().replace("-", "") + ext;
        Path target = targetDir.resolve(name);
        
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        
        return "/files/" + folder + "/" + name;
    }

    /**
     * Profil resmi kaydetme (kullanıcıya özel)
     */
    public String saveAvatar(MultipartFile file, String username) throws IOException {
        String ext = getFileExtension(file.getOriginalFilename());
        
        // Kullanıcı adı + timestamp ile benzersiz dosya adı
        String name = sanitizeUsername(username) + "_" + System.currentTimeMillis() + ext;
        Path target = avatarRoot.resolve(name);
        
        // Eski profil resimlerini temizle (opsiyonel)
        deleteOldAvatars(username);
        
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        
        return "/files/avatars/" + name;
    }

    /**
     * Dosya uzantısını al
     */
    private String getFileExtension(String filename) {
        if (filename == null) return "";
        int i = filename.lastIndexOf('.');
        return (i >= 0) ? filename.substring(i) : "";
    }

    /**
     * Username'i dosya adı için güvenli hale getir
     */
    private String sanitizeUsername(String username) {
        return username.replaceAll("[^a-zA-Z0-9]", "_");
    }

    /**
     * Kullanıcının eski profil resimlerini sil
     */
    private void deleteOldAvatars(String username) {
        try {
            String sanitized = sanitizeUsername(username);
            Files.list(avatarRoot)
                .filter(path -> path.getFileName().toString().startsWith(sanitized + "_"))
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException e) {
                        // Log the error but don't fail the upload
                        System.err.println("Could not delete old avatar: " + e.getMessage());
                    }
                });
        } catch (IOException e) {
            // Log the error but don't fail the upload
            System.err.println("Could not list old avatars: " + e.getMessage());
        }
    }
}
```

---

## 4. Static File Serving Configuration

Yeni bir config dosyası oluşturun:

**Dosya:** `src/main/java/com/example/backend/config/FileServingConfig.java`

```java
package com.example.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class FileServingConfig implements WebMvcConfigurer {
    
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // /files/** URL'lerini ./uploads klasörüne yönlendir
        registry.addResourceHandler("/files/**")
                .addResourceLocations("file:./uploads/")
                .setCachePeriod(3600); // 1 saat cache
    }
}
```

---

## 5. User Entity Güncelleme

`User.java` entity'nize `avatarUrl` field'ını ekleyin:

```java
@Entity
@Table(name = "app_user")
public class User {
    // ... diğer fieldlar ...
    
    @Column(name = "avatar_url")
    private String avatarUrl;
    
    // Getter ve Setter
    public String getAvatarUrl() {
        return avatarUrl;
    }
    
    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }
}
```

**Not:** `/upload-avatar` endpoint'i artık otomatik olarak user'ı güncelleyip döndüğü için 
`UserController`'da ayrı bir avatar güncelleme endpoint'ine gerek yok. Ancak `/api/users/me` PUT 
endpoint'iniz varsa, orada da `avatarUrl` güncellemesini desteklemelisiniz:

```java
@PutMapping("/me")
public ResponseEntity<?> updateProfile(@RequestBody UpdateUserDto dto, Authentication auth) {
    String email = auth.getName();
    User user = userService.findByEmail(email);
    
    if (dto.getAd() != null) user.setAd(dto.getAd());
    if (dto.getSoyad() != null) user.setSoyad(dto.getSoyad());
    if (dto.getEmail() != null) user.setEmail(dto.getEmail());
    if (dto.getAvatarUrl() != null) user.setAvatarUrl(dto.getAvatarUrl());
    
    User updated = userService.save(user);
    updated.setPassword(null); // Şifreyi response'da gönderme
    return ResponseEntity.ok(updated);
}
```

---

## 6. Test Etme

### 6.1. Backend'i Başlatın
```bash
./mvnw spring-boot:run
```

### 6.2. Test İstekleri

**Profil Resmi Yükleme (Otomatik User Güncelleme):**
```bash
curl -X POST http://localhost:8080/api/files/upload-avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg"
```

**Beklenen Yanıt (Güncellenmiş User Objesi):**
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

**Not:** Artık ayrı bir profil güncelleme isteği gerekmez! 
Endpoint hem resmi yükler hem de otomatik olarak user'ı günceller.

### 6.3. Dosya Erişimi Test
Tarayıcıdan: `http://localhost:8080/files/avatars/username_1234567890.jpg`

---

## 🔒 Güvenlik Notları

1. **Dosya Tipi Kontrolü**: Sadece image/* MIME type'lar kabul ediliyor
2. **Dosya Boyutu**: Maksimum 5MB
3. **Authentication**: Sadece giriş yapmış kullanıcılar yükleyebilir
4. **Dosya Adı Sanitization**: Kullanıcı adı güvenli hale getiriliyor
5. **Eski Dosyaları Temizleme**: Kullanıcının eski profil resimleri otomatik siliniyor

---

## 📁 Klasör Yapısı

```
./uploads/
├── avatars/          # Profil resimleri
│   ├── volkan_1698765432100.jpg
│   └── enes_1698765432200.png
└── general/          # Genel dosyalar (admin)
    └── abc123.pdf
```

---

## ⚠️ Sorun Giderme

### Resim yüklenemiyor
- `uploads/avatars` klasörünün yazma izni olduğundan emin olun
- Token'ın geçerli olduğunu kontrol edin
- Dosya boyutunun 5MB'dan küçük olduğundan emin olun

### Resim görünmüyor
- `/files/**` URL pattern'inin doğru ayarlandığını kontrol edin
- `FileServingConfig` class'ının Spring tarafından bulunduğundan emin olun
- `./uploads` klasörünün var olduğunu kontrol edin

### CORS Hatası
- `FileController`'daki `@CrossOrigin` ayarlarını kontrol edin
- Frontend URL'inin origins listesinde olduğundan emin olun

---

## ✅ Checklist

- [ ] Database'e `avatar_url` kolonu eklendi
- [ ] `FileController.java` güncellendi
- [ ] `FileStorageService.java` güncellendi
- [ ] `FileServingConfig.java` oluşturuldu
- [ ] `UserController.java` avatar_url güncellemesini destekliyor
- [ ] Backend test edildi
- [ ] Frontend ile entegrasyon test edildi

---

## 🚀 Üretim Ortamı İçin Öneriler

1. **Cloud Storage Kullanımı**: AWS S3, Google Cloud Storage, Azure Blob
2. **CDN**: CloudFlare, AWS CloudFront
3. **Image Optimization**: Thumbnail oluşturma, format dönüşümü
4. **Rate Limiting**: Spam önleme
5. **Virus Scanning**: Yüklenen dosyaları tara
6. **Database**: Avatar URL'lerini database'de sakla

