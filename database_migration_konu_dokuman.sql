-- Konulara Döküman Ekleme Migration
-- Bu SQL'i PostgreSQL database'inizde çalıştırın

-- 1. konu tablosuna döküman alanları ekle
ALTER TABLE konu 
ADD COLUMN IF NOT EXISTS dokuman_url TEXT,
ADD COLUMN IF NOT EXISTS dokuman_adi TEXT;

-- 2. Kolonlara yorum ekle
COMMENT ON COLUMN konu.dokuman_url IS 'Konu dökümanının dosya yolu (ör: /files/docs/matematik-turev.pdf)';
COMMENT ON COLUMN konu.dokuman_adi IS 'Dökümanın görünen adı (ör: Türev Konu Anlatımı)';

-- 3. Örnek veri ekleme (isteğe bağlı)
-- Kendi konularınıza göre güncelleyin

/*
UPDATE konu 
SET dokuman_url = '/files/docs/matematik-turev.pdf',
    dokuman_adi = 'Türev Konu Anlatımı'
WHERE ad = 'Türev';

UPDATE konu 
SET dokuman_url = '/files/docs/fizik-hareket.pdf',
    dokuman_adi = 'Hareket Konusu PDF'
WHERE ad = 'Hareket';

UPDATE konu 
SET dokuman_url = '/files/docs/kimya-atomlar.pdf',
    dokuman_adi = 'Atom Yapısı Ders Notları'
WHERE ad = 'Atom Yapısı';
*/

-- 4. Değişiklikleri kontrol et
SELECT 
    id,
    ad,
    dokuman_url,
    dokuman_adi,
    ders_id
FROM konu
ORDER BY ders_id, id
LIMIT 10;

-- 5. İstatistik: Kaç konuda döküman var?
SELECT 
    COUNT(*) as toplam_konu,
    COUNT(dokuman_url) as dokuman_olan_konu,
    COUNT(*) - COUNT(dokuman_url) as dokuman_olmayan_konu
FROM konu;

