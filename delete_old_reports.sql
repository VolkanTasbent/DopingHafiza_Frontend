-- ESKİ RAPORLARI SİLME (İlk 10 Oturum)
-- Bu SQL'i dikkatle çalıştırın! Geri alınamaz!

-- ÖNCE KONTROL ET: Hangi oturumlar silinecek?
SELECT 
    qs.id as oturum_id,
    qs.user_id,
    qs.started_at,
    qs.finished_at,
    COUNT(qsi.id) as soru_sayisi
FROM quiz_session qs
LEFT JOIN quiz_session_item qsi ON qsi.session_id = qs.id
GROUP BY qs.id
ORDER BY qs.finished_at ASC
LIMIT 10;

-- Eğer yukarıdaki sonuçlar doğruysa, aşağıdaki komutları çalıştırın:

-- 1. Adım: İlk 10 oturumun ID'lerini geçici tabloda sakla
CREATE TEMP TABLE temp_old_sessions AS
SELECT id 
FROM quiz_session 
ORDER BY finished_at ASC 
LIMIT 10;

-- 2. Adım: Önce oturum detaylarını sil (foreign key constraint için)
DELETE FROM quiz_session_item 
WHERE session_id IN (SELECT id FROM temp_old_sessions);

-- 3. Adım: Sonra oturumları sil
DELETE FROM quiz_session 
WHERE id IN (SELECT id FROM temp_old_sessions);

-- 4. Adım: Geçici tabloyu temizle
DROP TABLE temp_old_sessions;

-- Kontrol: Kaç kayıt silindi?
-- (Yukarıdaki komutlar çalıştırıldıktan sonra)
SELECT 'Silme işlemi tamamlandı' as durum;


-- ===================================================================
-- ALTERNATIF: Belirli bir tarihten ÖNCEKİ tüm raporları sil
-- ===================================================================

-- Örnek: 2024-10-01'den önceki tüm raporları sil
/*
DELETE FROM quiz_session_item 
WHERE session_id IN (
    SELECT id FROM quiz_session 
    WHERE finished_at < '2024-10-01'
);

DELETE FROM quiz_session 
WHERE finished_at < '2024-10-01';
*/


-- ===================================================================
-- ALTERNATIF: Sorusu silinmiş olan oturumları temizle
-- ===================================================================

-- Sorusu olmayan (null) item'ları bul
SELECT 
    qsi.id,
    qsi.session_id,
    qsi.soru_id,
    qs.finished_at
FROM quiz_session_item qsi
LEFT JOIN soru s ON s.id = qsi.soru_id
LEFT JOIN quiz_session qs ON qs.id = qsi.session_id
WHERE s.id IS NULL
ORDER BY qs.finished_at
LIMIT 20;

-- Sorusu silinmiş item'ları temizle
/*
DELETE FROM quiz_session_item 
WHERE soru_id NOT IN (SELECT id FROM soru);
*/

-- Hiç item'ı kalmayan oturumları sil
/*
DELETE FROM quiz_session 
WHERE id NOT IN (
    SELECT DISTINCT session_id 
    FROM quiz_session_item
);
*/

