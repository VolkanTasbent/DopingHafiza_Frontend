# 📚 Konulara Döküman Ekleme Rehberi

## 🎯 Hedef
Her konunun altına eğitim dökümanları/kaynakları eklemek.

## 📋 Yapılacaklar

### 1. Backend - Database Güncelleme
```sql
-- konu tablosuna döküman URL alanları ekle
ALTER TABLE konu 
ADD COLUMN dokuman_url TEXT,
ADD COLUMN dokuman_adi TEXT;

-- Örnek veri
UPDATE konu 
SET dokuman_url = '/files/docs/matematik-turev.pdf',
    dokuman_adi = 'Türev Konusu Anlatım'
WHERE ad = 'Türev';
```

### 2. Backend - API Güncelleme
`KonuDTO` veya entity'ye alanları ekle:
```java
private String dokumanUrl;
private String dokumanAdi;
```

### 3. Frontend - UI Tasarımı

#### Seçenek A: Döküman Linki
```jsx
{konu.dokumanUrl && (
  <a 
    href={fileUrl(konu.dokumanUrl)} 
    target="_blank"
    className="dokuman-link"
  >
    📄 {konu.dokumanAdi || 'Döküman İndir'}
  </a>
)}
```

#### Seçenek B: Döküman Modal
```jsx
<button onClick={() => openDokumanModal(konu)}>
  📖 Konuyu İncele
</button>
```

#### Seçenek C: Inline Döküman Görüntüleme
```jsx
<iframe 
  src={fileUrl(konu.dokumanUrl)} 
  className="dokuman-viewer"
/>
```

## 🎨 Önerilen Çözüm

**Basit ve Etkili:**
Her konu kartına döküman linki butonu ekle.

```jsx
<div className="konu-card">
  <h4>{konu.ad}</h4>
  <div className="konu-actions">
    <button onClick={() => onStartQuiz(konu.id)}>
      🚀 Bu Konudan Başla
    </button>
    {konu.dokumanUrl && (
      <a 
        href={fileUrl(konu.dokumanUrl)} 
        target="_blank"
        className="btn-dokuman"
      >
        📄 Döküman Görüntüle
      </a>
    )}
  </div>
</div>
```

## 📁 Döküman Yükleme Yöntemleri

### Yöntem 1: Static Files
```
/uploads/docs/
  ├── matematik-turev.pdf
  ├── fizik-hareket.pdf
  └── kimya-atomlar.pdf
```

### Yöntem 2: Backend Upload API
```java
@PostMapping("/upload-dokuman")
public Map<String,String> uploadDokuman(
    @RequestPart("file") MultipartFile file,
    @RequestParam Long konuId
) {
    // Dosyayı kaydet
    String url = fileStorageService.saveDokuman(file);
    
    // Konu'ya ata
    konu.setDokumanUrl(url);
    konuRepository.save(konu);
    
    return Map.of("url", url);
}
```

### Yöntem 3: External Links
Database'e direkt URL ekle:
```sql
UPDATE konu 
SET dokuman_url = 'https://example.com/docs/matematik.pdf'
WHERE id = 1;
```

## 🚀 Hızlı Başlangıç

1. Database'e kolonları ekle
2. Backend DTO'yu güncelle
3. Frontend'de butonu ekle
4. Dökümanları yükle

Hangi yöntemi tercih edersiniz?
