-- Profil resmi için avatar_url sütunu ekleme
-- Bu SQL'i database'inizde çalıştırın (PostgreSQL için)

-- 1. app_user tablosuna avatar_url sütunu ekle
ALTER TABLE app_user 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. avatar_url için yorum ekle
COMMENT ON COLUMN app_user.avatar_url IS 'Kullanıcının profil resmi URL yolu (ör: /files/avatars/username_123.jpg)';

-- 3. Değişiklikleri kontrol et
SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'app_user'
ORDER BY ordinal_position;

