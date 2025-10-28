# 🔍 Profil Resmi Görünmüyor - Sorun Giderme

## 1️⃣ Browser Console'u Kontrol Edin

1. Profil sayfasını açın
2. **F12** veya **Sağ Tık > Inspect** ile Developer Tools'u açın
3. **Console** sekmesine bakın

### Göreceğiniz Debug Mesajları:

```
👤 User Data: { id: 2, ad: "Volkan", ... }
🖼️ Avatar URL: /files/avatars/volkan_123.jpg
🎨 Rendering avatar: { avatarUrl: "/files/avatars/...", fullUrl: "http://localhost:8080/files/avatars/..." }
```

---

## 2️⃣ Olası Sorunlar ve Çözümler

### ❌ Sorun 1: "Avatar URL: undefined" veya "null"
**Neden:** Backend avatar_url'i kaydetmemiş veya döndürmüyor.

**Çözüm:**
```java
// FileController.java - uploadAvatar() metodunda:
user.setAvatarUrl(avatarUrl);  // Bu satır var mı?
User updatedUser = userService.save(user);  // Kaydediyor mu?
updatedUser.setPassword(null);
return updatedUser;  // User objesi dönüyor mu?
```

**Test:** Tarayıcıda `http://localhost:8080/api/users/me` adresine gidin (token ile).
Avatar URL görünüyor mu?

---

### ❌ Sorun 2: "Image load error" Console'da
**Neden:** Resim dosyası bulunamıyor (404).

**Çözüm A - FileServingConfig Eksik:**
```java
// config/FileServingConfig.java dosyası var mı?
@Configuration
public class FileServingConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/files/**")
                .addResourceLocations("file:./uploads/");
    }
}
```

**Çözüm B - Uploads Klasörü Eksik:**
```bash
# Backend proje klasöründe kontrol edin:
ls -la ./uploads/avatars/

# Eğer yoksa oluşturun:
mkdir -p ./uploads/avatars
```

**Çözüm C - Dosya Gerçekten Var mı:**
```bash
# Backend klasöründe:
ls -la ./uploads/avatars/
# Yüklediğiniz resmi görmeli
```

---

### ❌ Sorun 3: CORS Hatası
**Neden:** Backend CORS ayarları yanlış.

**Console'da göreceğiniz:**
```
Access to XMLHttpRequest at 'http://localhost:8080/files/avatars/...' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Çözüm:**
```java
// FileController.java
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"}, allowCredentials = "true")
```

---

### ❌ Sorun 4: Field İsmi Uyuşmazlığı (avatarUrl vs avatar_url)
**Neden:** Backend camelCase, database snake_case kullanıyor.

**Console'da:**
```
🖼️ Avatar URL: undefined  // Eğer undefined ise
```

**Çözüm A - User.java'da @JsonProperty:**
```java
@Column(name = "avatar_url")
@JsonProperty("avatar_url")  // 👈 Ekle
private String avatarUrl;
```

**Çözüm B - Application Properties:**
```properties
# application.properties veya application.yml
spring.jackson.property-naming-strategy=SNAKE_CASE
```

**Çözüm C - Frontend'de her ikisini de kontrol et (ZATEn EKLEDIM):**
```javascript
const avatarUrl = user.avatar_url || user.avatarUrl; // ✅ Her ikisini de dene
```

---

## 3️⃣ Manuel Test

### Test 1: Dosya Var mı?
```bash
# Backend klasöründe:
cd /path/to/backend
ls -la ./uploads/avatars/

# Dosya varsa şöyle görünmeli:
# -rw-r--r--  1 user  staff  12345  Oct 28 10:30 volkan_example_com_1698765432.jpg
```

### Test 2: Backend Dosyayı Serve Ediyor mu?
Tarayıcıda direkt URL'e gidin:
```
http://localhost:8080/files/avatars/DOSYA_ADI.jpg
```

✅ **Resim görünüyorsa:** FileServingConfig çalışıyor, sorun frontend'de  
❌ **404 hatası alıyorsanız:** FileServingConfig veya dosya yolu yanlış

### Test 3: API Response'u Kontrol Et
```bash
# Token'ınızı alın (localStorage'dan)
# Sonra:
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/users/me
```

Response'da `avatarUrl` veya `avatar_url` field'ı var mı?

---

## 4️⃣ Hızlı Düzeltme Checklist

Backend'de kontrol edin:

- [ ] `uploads/avatars` klasörü var mı?
- [ ] Resim dosyası klasörde var mı? (`ls ./uploads/avatars/`)
- [ ] `FileServingConfig.java` dosyası oluşturuldu mu?
- [ ] `User.java` entity'de `avatarUrl` field'ı var mı?
- [ ] Database'de `avatar_url` kolonu var mı? (migration çalıştı mı?)
- [ ] `FileController.uploadAvatar()` User döndürüyor mu?
- [ ] User kaydediliyor mu? (`userService.save(user)`)
- [ ] Browser'da `http://localhost:8080/files/avatars/DOSYA.jpg` çalışıyor mu?

Frontend'de:

- [ ] `fileUrl()` import edildi mi? (`import { fileUrl } from "./services/api"`)
- [ ] Console'da avatar URL görünüyor mu?
- [ ] Console'da "Image load error" var mı?

---

## 5️⃣ En Sık Karşılaşılan Sorun

### 🔥 FileServingConfig Eksik veya Çalışmıyor

**Belirti:**
- Dosya `./uploads/avatars/` klasöründe var
- Backend'den URL doğru dönüyor: `/files/avatars/xxx.jpg`
- Ama tarayıcıda `http://localhost:8080/files/avatars/xxx.jpg` → **404**

**Çözüm:**

1. `FileServingConfig.java` dosyasını oluşturun (yoksa):

```java
package com.example.backend.config;  // 👈 Paket adınıza göre değiştirin

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class FileServingConfig implements WebMvcConfigurer {
    
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/files/**")
                .addResourceLocations("file:./uploads/")
                .setCachePeriod(3600);
    }
}
```

2. Backend'i **yeniden başlatın** (önemli!)

3. Test edin:
```
http://localhost:8080/files/avatars/DOSYA_ADI.jpg
```

---

## 6️⃣ Database Kontrolü

PostgreSQL'de kontrol edin:

```sql
-- app_user tablosunda avatar_url kolonunu kontrol et
SELECT id, ad, soyad, email, avatar_url 
FROM app_user 
WHERE id = YOUR_USER_ID;

-- Eğer avatar_url NULL ise, backend kaydetmiyor demektir
```

---

## 7️⃣ Backend Log Kontrolü

Backend console'unda şu mesajları görüyor musunuz?

```
✅ İyi:
- Hibernate: insert into ... (başarılı save)
- Dosya kaydedildi: ./uploads/avatars/xxx.jpg

❌ Kötü:
- NullPointerException
- FileNotFoundException
- AccessDeniedException
```

---

## 8️⃣ Frontend Network Tab

1. Developer Tools > **Network** sekmesi
2. Profil sayfasını yenileyin
3. `/api/users/me` isteğine tıklayın
4. **Response** sekmesinde `avatarUrl` var mı?

---

## 🎯 Hızlı Test Komutu

```bash
# Terminal 1 - Backend
cd /path/to/backend
./mvnw spring-boot:run

# Terminal 2 - Frontend  
cd /path/to/frontend
npm run dev

# Terminal 3 - Test
# Dosya yükle
curl -X POST http://localhost:8080/api/files/upload-avatar \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/path/to/test.jpg"

# Sonucu kontrol et
curl -H "Authorization: Bearer TOKEN" http://localhost:8080/api/users/me

# Dosyaya direkt eriş
curl http://localhost:8080/files/avatars/DOSYA.jpg
```

---

## 💡 En Hızlı Çözüm

Eğer hala çalışmıyorsa:

1. **Console**'daki debug mesajlarının screenshot'ını alın
2. **Network** tab'ındaki `/api/users/me` response'unun screenshot'ını alın
3. Backend'de `ls -la ./uploads/avatars/` çıktısını paylaşın

Bu bilgilerle tam olarak nerede sorun olduğunu tespit edebiliriz!

---

## ✅ Başarı Göstergeleri

Her şey doğru çalışıyorsa Console'da görecekleriniz:

```
👤 User Data: {id: 2, ad: "Volkan", email: "...", avatarUrl: "/files/avatars/volkan_...jpg"}
🖼️ Avatar URL: /files/avatars/volkan_1234567890.jpg
🎨 Rendering avatar: {
  avatarUrl: "/files/avatars/volkan_1234567890.jpg",
  fullUrl: "http://localhost:8080/files/avatars/volkan_1234567890.jpg"
}
✅ Image loaded successfully: http://localhost:8080/files/avatars/volkan_1234567890.jpg
```

Ve resim ekranda görünür! 🎉

