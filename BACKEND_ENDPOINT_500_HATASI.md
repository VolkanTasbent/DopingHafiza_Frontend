# Backend 500 Hatası - "No static resource api/konu/111" Çözümü

## 🔴 Hata

```
PUT http://localhost:8080/api/konu/111 500 (Internal Server Error)
Error: "No static resource api/konu/111."
Type: "NoResourceFoundException"
```

## 🔍 Sorun

Bu hata, Spring Boot'ta endpoint'in bulunamadığını gösteriyor. Backend'de `PUT /api/konu/{konuId}` endpoint'i tanımlı değil veya yanlış tanımlanmış.

## ✅ Çözüm

### 1. Controller'ın Doğru Tanımlandığından Emin Olun

#### Java Spring Boot - Tam Controller Örneği

```java
package com.example.controller; // Kendi package'ınızı kullanın

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/konu")  // ✅ Bu önemli!
@CrossOrigin(origins = "*")  // Frontend için CORS
public class KonuController {
    
    @Autowired
    private KonuService konuService;
    
    // ✅ Bu endpoint MUTLAKA olmalı!
    @PutMapping("/{konuId}")  // ✅ Path variable doğru mu?
    @PreAuthorize("hasRole('ADMIN')")  // Yetkilendirme
    public ResponseEntity<?> updateKonu(
            @PathVariable Long konuId,  // ✅ Path variable
            @RequestBody KonuUpdateDTO updateDTO) {  // ✅ Request body
        
        try {
            Konu updatedKonu = konuService.updateKonu(konuId, updateDTO);
            return ResponseEntity.ok(updatedKonu);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                .body(Map.of("error", e.getMessage()));
        }
    }
}
```

### 2. Controller'ın Component Scan'de Olduğundan Emin Olun

#### Application.java veya Main Class

```java
@SpringBootApplication
@ComponentScan(basePackages = {"com.example"})  // ✅ Controller package'ınızı ekleyin
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 3. DTO Sınıfını Kontrol Edin

```java
package com.example.dto;

public class KonuUpdateDTO {
    private String ad;
    private String aciklama;
    private String konuAnlatimVideosuUrl;  // ✅ Bu alan MUTLAKA olmalı!
    private String dokumanUrl;
    
    // ✅ Getter ve Setter'lar MUTLAKA olmalı!
    public String getKonuAnlatimVideosuUrl() {
        return konuAnlatimVideosuUrl;
    }
    
    public void setKonuAnlatimVideosuUrl(String konuAnlatimVideosuUrl) {
        this.konuAnlatimVideosuUrl = konuAnlatimVideosuUrl;
    }
    
    // Diğer getter/setter'lar...
    
    // Default constructor MUTLAKA olmalı!
    public KonuUpdateDTO() {
    }
}
```

### 4. Service Sınıfını Kontrol Edin

```java
package com.example.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service  // ✅ @Service annotation'ı olmalı!
public class KonuService {
    
    @Autowired
    private KonuRepository konuRepository;
    
    public Konu updateKonu(Long konuId, KonuUpdateDTO updateDTO) {
        Konu konu = konuRepository.findById(konuId)
            .orElseThrow(() -> new RuntimeException("Konu bulunamadı: " + konuId));
        
        // ✅ Partial update - sadece gönderilen alanları güncelle
        if (updateDTO.getKonuAnlatimVideosuUrl() != null) {
            konu.setKonuAnlatimVideosuUrl(updateDTO.getKonuAnlatimVideosuUrl().trim());
        }
        
        if (updateDTO.getAd() != null) {
            konu.setAd(updateDTO.getAd().trim());
        }
        
        if (updateDTO.getAciklama() != null) {
            konu.setAciklama(updateDTO.getAciklama().trim());
        }
        
        if (updateDTO.getDokumanUrl() != null) {
            konu.setDokumanUrl(updateDTO.getDokumanUrl().trim());
        }
        
        return konuRepository.save(konu);
    }
}
```

### 5. Entity Sınıfını Kontrol Edin

```java
package com.example.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "konu")
public class Konu {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String ad;
    
    @Column(columnDefinition = "TEXT")
    private String aciklama;
    
    // ✅ Video URL alanı
    @Column(name = "konu_anlatim_videosu_url")
    private String konuAnlatimVideosuUrl;
    
    @Column(name = "dokuman_url")
    private String dokumanUrl;
    
    @ManyToOne
    @JoinColumn(name = "ders_id", nullable = false)
    private Ders ders;
    
    // ✅ Getter ve Setter'lar
    public String getKonuAnlatimVideosuUrl() {
        return konuAnlatimVideosuUrl;
    }
    
    public void setKonuAnlatimVideosuUrl(String konuAnlatimVideosuUrl) {
        this.konuAnlatimVideosuUrl = konuAnlatimVideosuUrl;
    }
    
    // Diğer getter/setter'lar...
}
```

## 🔧 Hızlı Kontrol Listesi

Backend'de şunları kontrol edin:

- [ ] `KonuController` sınıfı var mı?
- [ ] `@RestController` annotation'ı var mı?
- [ ] `@RequestMapping("/api/konu")` doğru mu?
- [ ] `@PutMapping("/{konuId}")` metodu var mı?
- [ ] `@PathVariable Long konuId` parametresi var mı?
- [ ] `@RequestBody KonuUpdateDTO` parametresi var mı?
- [ ] `KonuUpdateDTO` sınıfı var mı ve getter/setter'ları var mı?
- [ ] `KonuService` sınıfı var mı ve `@Service` annotation'ı var mı?
- [ ] Controller package'ı component scan'de mi?
- [ ] CORS ayarları doğru mu?

## 🧪 Test Etme

### 1. Backend Log'larını Kontrol Edin

Backend'i çalıştırdığınızda şu log'ları görmelisiniz:

```
Mapped "{[/api/konu/{konuId}],methods=[PUT]}" onto ...
```

Eğer bu log'u görmüyorsanız, endpoint tanımlı değil demektir.

### 2. Endpoint'leri Listeleme

Spring Boot Actuator kullanarak endpoint'leri listeleyebilirsiniz:

```java
// application.properties
management.endpoints.web.exposure.include=*
```

Sonra: `http://localhost:8080/actuator/mappings` adresine gidin ve `/api/konu` endpoint'ini arayın.

### 3. cURL ile Test

```bash
curl -X PUT http://localhost:8080/api/konu/111 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "konuAnlatimVideosuUrl": "https://www.youtube.com/watch?v=test"
  }'
```

## 🚨 Yaygın Hatalar

### Hata 1: Controller Package'ı Component Scan'de Değil

**Çözüm:**
```java
@SpringBootApplication
@ComponentScan(basePackages = {"com.example.controller", "com.example.service"})
public class Application {
    // ...
}
```

### Hata 2: RequestMapping Yanlış

**Yanlış:**
```java
@RequestMapping("/konu")  // ❌ /api eksik
```

**Doğru:**
```java
@RequestMapping("/api/konu")  // ✅
```

### Hata 3: Path Variable Yanlış

**Yanlış:**
```java
@PutMapping("/{id}")  // ❌
public ResponseEntity<?> updateKonu(@PathVariable Long id, ...)
```

**Doğru:**
```java
@PutMapping("/{konuId}")  // ✅
public ResponseEntity<?> updateKonu(@PathVariable Long konuId, ...)
```

### Hata 4: DTO'da Getter/Setter Yok

**Çözüm:** DTO'da tüm field'lar için getter ve setter ekleyin.

### Hata 5: CORS Sorunu

**Çözüm:**
```java
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/konu")
public class KonuController {
    // ...
}
```

## 📝 Minimal Çalışan Örnek

Eğer hala çalışmıyorsa, bu minimal örneği kullanın:

```java
@RestController
@RequestMapping("/api/konu")
@CrossOrigin(origins = "*")
public class KonuController {
    
    @Autowired
    private KonuRepository konuRepository;
    
    @PutMapping("/{konuId}")
    public ResponseEntity<Map<String, Object>> updateKonu(
            @PathVariable Long konuId,
            @RequestBody Map<String, Object> request) {
        
        try {
            Konu konu = konuRepository.findById(konuId)
                .orElseThrow(() -> new RuntimeException("Konu bulunamadı"));
            
            // Video URL'yi al
            if (request.containsKey("konuAnlatimVideosuUrl")) {
                String videoUrl = (String) request.get("konuAnlatimVideosuUrl");
                konu.setKonuAnlatimVideosuUrl(videoUrl != null ? videoUrl.trim() : null);
            }
            
            konu = konuRepository.save(konu);
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", konu.getId());
            response.put("ad", konu.getAd());
            response.put("konuAnlatimVideosuUrl", konu.getKonuAnlatimVideosuUrl());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }
}
```

## ✅ Sonuç

Backend'de `PUT /api/konu/{konuId}` endpoint'ini yukarıdaki örneklere göre ekleyin. Endpoint tanımlandıktan sonra 500 hatası çözülecektir.










