# 📚 Backend - Konu Döküman Entegrasyonu

## 🎯 Genel Bakış

Konulara PDF döküman ekleme özelliği için backend güncellemeleri.

---

## 1️⃣ Database Migration

```sql
-- database_migration_konu_dokuman.sql dosyasını çalıştırın
ALTER TABLE konu 
ADD COLUMN IF NOT EXISTS dokuman_url TEXT,
ADD COLUMN IF NOT EXISTS dokuman_adi TEXT;
```

---

## 2️⃣ Entity Güncelleme

### `Konu.java` (Entity)
```java
@Entity
@Table(name = "konu")
public class Konu {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String ad;
    private String aciklama;
    
    @Column(name = "ders_id")
    private Long dersId;
    
    // YENİ ALANLAR
    @Column(name = "dokuman_url")
    private String dokumanUrl;
    
    @Column(name = "dokuman_adi")
    private String dokumanAdi;
    
    // Getters & Setters
    public String getDokumanUrl() { return dokumanUrl; }
    public void setDokumanUrl(String dokumanUrl) { this.dokumanUrl = dokumanUrl; }
    
    public String getDokumanAdi() { return dokumanAdi; }
    public void setDokumanAdi(String dokumanAdi) { this.dokumanAdi = dokumanAdi; }
}
```

---

## 3️⃣ DTO Güncelleme (Eğer kullanıyorsanız)

### `KonuDTO.java`
```java
public class KonuDTO {
    private Long id;
    private String ad;
    private String aciklama;
    private Long dersId;
    
    // YENİ ALANLAR
    private String dokumanUrl;
    private String dokumanAdi;
    
    // Getters & Setters
    public String getDokumanUrl() { return dokumanUrl; }
    public void setDokumanUrl(String dokumanUrl) { this.dokumanUrl = dokumanUrl; }
    
    public String getDokumanAdi() { return dokumanAdi; }
    public void setDokumanAdi(String dokumanAdi) { this.dokumanAdi = dokumanAdi; }
}
```

---

## 4️⃣ Controller (İsteğe Bağlı - Döküman Yükleme)

### `FileController.java` - Döküman Upload Endpoint Ekle

```java
@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = {"http://localhost:5173"}, allowCredentials = "true")
public class FileController {
    
    private final FileStorageService storage;
    private final KonuRepository konuRepository;
    
    public FileController(FileStorageService storage, KonuRepository konuRepository) {
        this.storage = storage;
        this.konuRepository = konuRepository;
    }
    
    /**
     * Konu dökümanı yükleme
     * POST /api/files/upload-dokuman
     */
    @PostMapping(value = "/upload-dokuman", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> uploadDokuman(
            @RequestPart("file") MultipartFile file,
            @RequestParam Long konuId,
            @RequestParam(required = false) String dokumanAdi
    ) throws Exception {
        
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Dosya boş");
        }
        
        // Dosya tipini kontrol et
        String contentType = file.getContentType();
        if (!contentType.equals("application/pdf")) {
            throw new IllegalArgumentException("Sadece PDF dosyaları yüklenebilir");
        }
        
        // Dosyayı kaydet
        String url = storage.saveDokuman(file);
        
        // Konu'yu bul ve güncelle
        Konu konu = konuRepository.findById(konuId)
                .orElseThrow(() -> new RuntimeException("Konu bulunamadı"));
        
        konu.setDokumanUrl(url);
        konu.setDokumanAdi(dokumanAdi != null ? dokumanAdi : file.getOriginalFilename());
        konuRepository.save(konu);
        
        return Map.of(
            "success", true,
            "url", url,
            "konuId", konuId,
            "dokumanAdi", konu.getDokumanAdi()
        );
    }
}
```

---

## 5️⃣ Service Güncelleme

### `FileStorageService.java` - Döküman Kaydetme

```java
@Service
public class FileStorageService {
    
    private final Path root = Paths.get("./uploads").toAbsolutePath().normalize();
    private final Path docsRoot = Paths.get("./uploads/docs").toAbsolutePath().normalize();
    
    public FileStorageService() throws IOException {
        Files.createDirectories(root);
        Files.createDirectories(docsRoot);
    }
    
    /**
     * Avatar kaydetme (mevcut)
     */
    public String save(MultipartFile file) throws IOException {
        // ... mevcut kod
    }
    
    /**
     * Döküman kaydetme (YENİ)
     */
    public String saveDokuman(MultipartFile file) throws IOException {
        String ext = "";
        String original = file.getOriginalFilename();
        if (original != null) {
            int i = original.lastIndexOf('.');
            if (i >= 0) ext = original.substring(i);
        }
        
        // Dosya adını temizle ve timestamp ekle
        String baseName = original != null ? 
            original.substring(0, original.lastIndexOf('.')).replaceAll("[^a-zA-Z0-9]", "_") : 
            "dokuman";
        String name = baseName + "_" + System.currentTimeMillis() + ext;
        
        Path target = docsRoot.resolve(name);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        
        // Sunulacak URL
        return "/files/docs/" + name;
    }
}
```

---

## 6️⃣ Static File Serving (Zaten Var)

### `FileServingConfig.java`
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

Bu yapılandırma ile:
- `/files/docs/matematik.pdf` → `./uploads/docs/matematik.pdf`

---

## 7️⃣ Kullanım Senaryoları

### Senaryo A: Manuel Database Update (En Basit)

```sql
-- PDF'leri uploads/docs/ klasörüne kopyalayın
-- Database'de URL'leri güncelleyin

UPDATE konu 
SET dokuman_url = '/files/docs/turev-anlatim.pdf',
    dokuman_adi = 'Türev Konu Anlatımı'
WHERE ad = 'Türev';
```

### Senaryo B: Upload API Kullanımı (ADMIN)

```bash
# cURL ile döküman yükleme
curl -X POST http://localhost:8080/api/files/upload-dokuman \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "file=@matematik-turev.pdf" \
  -F "konuId=1" \
  -F "dokumanAdi=Türev Konu Anlatımı"
```

### Senaryo C: External URL

```sql
-- Harici bir PDF linki
UPDATE konu 
SET dokuman_url = 'https://example.com/docs/matematik.pdf',
    dokuman_adi = 'Matematik Dökümanı'
WHERE id = 1;
```

---

## 8️⃣ Dosya Yapısı

```
uploads/
├── avatars/          (mevcut)
│   ├── user1.jpg
│   └── user2.png
└── docs/             (YENİ)
    ├── matematik-turev.pdf
    ├── fizik-hareket.pdf
    └── kimya-atomlar.pdf
```

---

## 9️⃣ Test Etme

### 1. Database'i Güncelle
```sql
ALTER TABLE konu ADD COLUMN dokuman_url TEXT;
ALTER TABLE konu ADD COLUMN dokuman_adi TEXT;
```

### 2. Örnek Veri Ekle
```sql
UPDATE konu 
SET dokuman_url = '/files/docs/test.pdf',
    dokuman_adi = 'Test Dökümanı'
WHERE id = 1;
```

### 3. Backend'i Yeniden Başlat
```bash
./mvnw spring-boot:run
```

### 4. Frontend'i Test Et
- Derslerim → Detay → Konular
- "📄 Döküman Görüntüle" butonu görünmeli
- Butona basınca modal açılmalı
- PDF görüntülenmeli

---

## 🎉 Tamamlandı!

Artık konularınıza PDF döküman ekleyebilirsiniz! 🚀

### Hızlı Checklist ✅

- [x] Database migration çalıştırıldı
- [x] Entity güncellendi
- [x] DTO güncellendi (isteğe bağlı)
- [x] FileStorageService'e saveDokuman eklendi (isteğe bağlı)
- [x] FileController'a upload endpoint eklendi (isteğe bağlı)
- [x] uploads/docs/ klasörü oluşturuldu
- [x] Test PDF yüklendi
- [x] Frontend test edildi

---

## 💡 İpuçları

1. **PDF Boyutu:** Büyük PDF'ler için `spring.servlet.multipart.max-file-size` ayarını artırın
2. **Güvenlik:** Sadece ADMIN rolü döküman yükleyebilir
3. **Validasyon:** Sadece PDF dosyalarına izin verin
4. **Performans:** Büyük PDF'leri CDN'de host edin

