# 📸 Profil Resmi Sistemi - Kurulum Özeti

Profil sayfanız modern bir görünüme kavuşturuldu ve resim yükleme özelliği eklendi.

## ✨ Yeni Özellikler

### Frontend (Tamamlandı ✅)
- 🎨 Modern, profesyonel profil sayfası tasarımı
- 📷 Profil resmi yükleme ve görüntüleme
- ✏️ Profil bilgilerini düzenleme (ad, soyad, email)
- 🔤 Resim yoksa baş harflerle avatar gösterimi
- 📱 Responsive tasarım (mobil uyumlu)
- 🎭 Animasyonlar ve hover efektleri
- 🏷️ Renkli rol rozetleri (ADMIN/USER)

### Backend (Yapılacak ⏳)
- 📤 Profil resmi upload endpoint'i
- 💾 Dosya kaydetme ve yönetimi
- 🔒 Güvenlik kontrolleri (dosya tipi, boyut)
- 🗑️ Eski resimleri otomatik temizleme

---

## 🚀 Hızlı Başlangıç

### Adım 1: Database Migration
```bash
# database_migration_avatar.sql dosyasını PostgreSQL database'inize çalıştırın
```

### Adım 2: Backend Güncellemeleri
Backend'inize aşağıdaki dosyaları ekleyin/güncelleyin:

1. **FileController.java** - `/api/files/upload-avatar` endpoint'i ekle
2. **FileStorageService.java** - `saveAvatar()` metodu ekle
3. **FileServingConfig.java** (YENİ) - Static file serving
4. **UserController.java** - `avatar_url` güncellemesini destekle

> 📚 Detaylı talimatlar için: `BACKEND_PROFIL_RESMI_KURULUM.md`

### Adım 3: Test
```bash
# Backend'i başlat
./mvnw spring-boot:run

# Frontend'i başlat
npm run dev

# Profil sayfasına git ve resim yükle
```

---

## 📁 Dosya Yapısı

### Frontend ✅ (Hazır)
```
src/
├── Profilim.jsx          # ✅ Güncellendi - Modern profil sayfası
├── Profilim.css          # ✅ Güncellendi - Yeni tasarım
└── services/
    └── api.js            # ✅ Zaten hazır - fileUrl() fonksiyonu mevcut
```

### Backend ⏳ (Güncellenecek)
```
src/main/java/com/example/backend/
├── controller/
│   ├── FileController.java       # ⏳ Güncelle
│   └── UserController.java       # ⏳ avatar_url desteği ekle
├── service/
│   └── FileStorageService.java   # ⏳ Güncelle
└── config/
    └── FileServingConfig.java    # 🆕 Yeni dosya
```

### Database ⏳
```sql
app_user
├── id
├── ad
├── soyad
├── email
├── password
├── role
└── avatar_url  # ⏳ Yeni kolon eklenecek
```

---

## 🔧 Backend Kod Örnekleri

### 1. FileController - Upload Avatar Endpoint

```java
@PostMapping(value = "/upload-avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
@PreAuthorize("isAuthenticated()")
public Map<String,String> uploadAvatar(
        @RequestPart("file") MultipartFile file,
        Authentication auth) throws Exception {
    
    // Validations
    if (file.isEmpty()) throw new IllegalArgumentException("Dosya boş");
    if (!file.getContentType().startsWith("image/")) {
        throw new IllegalArgumentException("Sadece resim dosyaları");
    }
    if (file.getSize() > 5 * 1024 * 1024) {
        throw new IllegalArgumentException("Max 5MB");
    }
    
    String url = storage.saveAvatar(file, auth.getName());
    return Map.of("url", url);
}
```

### 2. FileStorageService - Save Avatar

```java
public String saveAvatar(MultipartFile file, String username) throws IOException {
    String ext = getFileExtension(file.getOriginalFilename());
    String name = sanitizeUsername(username) + "_" + System.currentTimeMillis() + ext;
    Path target = avatarRoot.resolve(name);
    
    deleteOldAvatars(username); // Eski resimleri temizle
    Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
    
    return "/files/avatars/" + name;
}
```

### 3. FileServingConfig - Static Files

```java
@Configuration
public class FileServingConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/files/**")
                .addResourceLocations("file:./uploads/");
    }
}
```

---

## 🔒 Güvenlik Özellikleri

- ✅ Sadece giriş yapmış kullanıcılar yükleyebilir
- ✅ Sadece image/* MIME type kabul edilir
- ✅ Maksimum 5MB dosya boyutu
- ✅ Kullanıcı adı sanitization
- ✅ Eski dosyalar otomatik temizlenir
- ✅ JWT token doğrulaması

---

## 📊 Nasıl Çalışır?

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│   Frontend  │────1───▶│   Backend   │────2───▶│  File System │
│  (React)    │         │  (Spring)   │         │  ./uploads/  │
└─────────────┘         └─────────────┘         └──────────────┘
      │                       │                         │
      │                       │                         │
      │◀──────3: URL──────────┤                         │
      │                       │                         │
      │────4: Update Profile──▶                         │
      │                       │                         │
      │◀──────5: Success──────┤                         │
      │                       │                         │
      │────6: Display Image───────────────────────────▶│
      │                                                 │
      │◀─────────────7: Image File─────────────────────┘

1. Kullanıcı resim seçer → FormData ile /api/files/upload-avatar
2. Backend dosyayı ./uploads/avatars/ klasörüne kaydeder
3. Backend URL döner: /files/avatars/username_123.jpg
4. Frontend avatar_url'yi user profiline kaydeder (/api/users/me)
5. Backend başarı mesajı döner
6. Frontend resmi gösterir (fileUrl() ile tam URL)
7. Browser dosyayı backend'den alır
```

---

## 🎯 API Endpoints

### 1. Profil Resmi Yükleme
```
POST /api/files/upload-avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body: file (image file)

Response:
{
  "url": "/files/avatars/username_1234567890.jpg",
  "message": "Profil resmi başarıyla yüklendi"
}
```

### 2. Profil Güncelleme
```
PUT /api/users/me
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "ad": "Volkan",
  "soyad": "Tasbent",
  "email": "volkan@example.com",
  "avatar_url": "/files/avatars/username_1234567890.jpg"
}
```

### 3. Profil Resmine Erişim
```
GET /files/avatars/username_1234567890.jpg

Response: Image file
```

---

## ✅ Test Checklist

### Frontend Test
- [ ] Profil sayfası açılıyor
- [ ] Resim yoksa baş harfler görünüyor
- [ ] Resim seçme butonu çalışıyor
- [ ] Resim yükleniyor (spinner gösteriliyor)
- [ ] Başarı mesajı görünüyor
- [ ] Yüklenen resim görüntüleniyor
- [ ] Profil düzenleme çalışıyor
- [ ] Mobil görünüm düzgün

### Backend Test
- [ ] Database'de avatar_url kolonu var
- [ ] /api/files/upload-avatar endpoint çalışıyor
- [ ] ./uploads/avatars klasörü oluşuyor
- [ ] Dosya doğru kaydediliyor
- [ ] Eski dosyalar siliniyor
- [ ] /files/** URL'leri serve ediliyor
- [ ] Sadece resim dosyaları kabul ediliyor
- [ ] 5MB limiti çalışıyor
- [ ] Authentication kontrolü yapılıyor

---

## 📞 Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| Resim yüklenemiyor | Backend'de `/api/files/upload-avatar` endpoint'ini kontrol edin |
| Resim görünmüyor | `FileServingConfig` class'ının eklendiğinden emin olun |
| 404 Not Found | `/files/**` URL mapping'ini kontrol edin |
| CORS hatası | `FileController`'da CORS ayarlarını kontrol edin |
| Dosya kaydedilmiyor | `./uploads/avatars` klasörünün yazma izni olduğunu kontrol edin |
| Database hatası | `avatar_url` kolonunun eklendiğini kontrol edin |

---

## 📚 Dökümantasyon

- **Detaylı Backend Kurulum**: `BACKEND_PROFIL_RESMI_KURULUM.md`
- **Database Migration**: `database_migration_avatar.sql`
- **Frontend Kodu**: `src/Profilim.jsx`, `src/Profilim.css`

---

## 🎉 Sonraki Adımlar

1. ✅ Frontend hazır - test edebilirsiniz (resim yok modunda)
2. ⏳ Backend güncellemelerini yapın
3. ⏳ Database migration'ı çalıştırın
4. 🚀 Test edin ve kullanmaya başlayın!

---

**Not:** Frontend kodu tamamen hazır. Backend'i güncelledikten sonra sistem çalışmaya başlayacak!

