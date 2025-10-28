# 🗑️ Eski Raporları Silme Rehberi

## Sorun
Eski raporlardaki sorular silindiği için, rapor detayları boş geliyor veya hata veriyor.

## Çözüm
Sorusu silinmiş olan eski raporları database'den temizleyin.

---

## 📋 Adım 1: Database'e Bağlanın

PostgreSQL'e bağlanın (Supabase veya başka).

---

## 📋 Adım 2: Önce Kontrol Edin

Hangi oturumların sorusu silinmiş kontrol edin:

```sql
-- Sorusu silinmiş item'ları bul
SELECT 
    qsi.id as item_id,
    qsi.session_id,
    qsi.soru_id,
    qs.finished_at,
    qs.user_id
FROM quiz_session_item qsi
LEFT JOIN soru s ON s.id = qsi.soru_id
LEFT JOIN quiz_session qs ON qs.id = qsi.session_id
WHERE s.id IS NULL
ORDER BY qs.finished_at
LIMIT 50;
```

---

## 📋 Adım 3: Silme İşlemleri

### Seçenek A: İlk 10 Raporu Sil

```sql
-- 1. Geçici tablo oluştur
CREATE TEMP TABLE temp_old_sessions AS
SELECT id 
FROM quiz_session 
ORDER BY finished_at ASC 
LIMIT 10;

-- 2. Detayları sil
DELETE FROM quiz_session_item 
WHERE session_id IN (SELECT id FROM temp_old_sessions);

-- 3. Oturumları sil
DELETE FROM quiz_session 
WHERE id IN (SELECT id FROM temp_old_sessions);

-- 4. Temizlik
DROP TABLE temp_old_sessions;
```

### Seçenek B: Belirli Tarihten Önceki Raporları Sil

```sql
-- Örnek: 2024-10-15'ten önceki raporları sil
DELETE FROM quiz_session_item 
WHERE session_id IN (
    SELECT id FROM quiz_session 
    WHERE finished_at < '2024-10-15'
);

DELETE FROM quiz_session 
WHERE finished_at < '2024-10-15';
```

### Seçenek C: Sorusu Silinmiş Olan Raporları Temizle (ÖNERİLEN)

```sql
-- 1. Sorusu olmayan item'ları sil
DELETE FROM quiz_session_item 
WHERE soru_id NOT IN (SELECT id FROM soru);

-- 2. Item'ı kalmayan oturumları sil
DELETE FROM quiz_session 
WHERE id NOT IN (
    SELECT DISTINCT session_id 
    FROM quiz_session_item
    WHERE session_id IS NOT NULL
);
```

---

## ⚠️ Önemli Uyarılar

1. **Backup Alın!** İşlem geri alınamaz.
```sql
-- Backup (örnek)
CREATE TABLE quiz_session_backup AS SELECT * FROM quiz_session;
CREATE TABLE quiz_session_item_backup AS SELECT * FROM quiz_session_item;
```

2. **Test Edin!** Önce SELECT ile kontrol edin, sonra DELETE yapın.

3. **Kullanıcılara Bildirin!** Eski raporlar silinecekse kullanıcıları bilgilendirin.

---

## 🔍 Kontrol Sorguları

### Toplam Rapor Sayısı
```sql
SELECT COUNT(*) as toplam_rapor FROM quiz_session;
```

### Sorusu Silinmiş Item Sayısı
```sql
SELECT COUNT(*) as silinmis_soru_item
FROM quiz_session_item qsi
LEFT JOIN soru s ON s.id = qsi.soru_id
WHERE s.id IS NULL;
```

### En Eski Raporlar
```sql
SELECT 
    id,
    user_id,
    started_at,
    finished_at,
    (SELECT COUNT(*) FROM quiz_session_item WHERE session_id = quiz_session.id) as item_count
FROM quiz_session
ORDER BY finished_at ASC
LIMIT 10;
```

---

## ✅ İşlem Sonrası

1. Frontend'i yenileyin
2. Raporlar sayfasını test edin
3. Eski raporların gittiğini doğrulayın

---

## 🔄 Otomatik Temizlik (İsteğe Bağlı)

Database'de otomatik temizlik için trigger oluşturabilirsiniz:

```sql
-- Soru silindiğinde ilgili item'ları da sil
CREATE OR REPLACE FUNCTION cleanup_deleted_soru_items()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM quiz_session_item WHERE soru_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_soru_items
BEFORE DELETE ON soru
FOR EACH ROW
EXECUTE FUNCTION cleanup_deleted_soru_items();
```

---

## 📞 Yardım

Herhangi bir sorun yaşarsanız:
1. Backup'ınızın olduğundan emin olun
2. SQL sorgularını küçük parçalarda test edin
3. `LIMIT 1` ile tek kayıt üzerinde deneyin

**NOT:** `delete_old_reports.sql` dosyasında hazır SQL komutları var!

