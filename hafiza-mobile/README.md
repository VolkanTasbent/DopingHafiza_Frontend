# Hafiza Mobile

Bu proje, `hafiza-web` ile ayni backend'e baglanan Expo tabanli mobil uygulama MVP'sidir.

## Kurulum

```bash
npm install
```

## API Ayari

`.env` dosyasi olustur:

```bash
EXPO_PUBLIC_API_URL=http://localhost:8080
```

Notlar:
- Android emulator icin genelde: `http://10.0.2.2:8080`
- Fiziksel cihazda backend'in LAN IP'sini kullanin (ornek: `http://192.168.1.10:8080`)
- Backend CORS tarafinda mobil origin'e izin gerekmiyor; native app origin'siz calisir.

## Calistirma

```bash
npm start
```

veya:

```bash
npm run android
npm run ios
npm run web
```

## Bu Surumde Olanlar

- Login / Register (`/api/auth/login`, `/api/auth/register`)
- Kullanici session/token yonetimi (`/api/users/me`)
- Ders listesi (`/api/ders`)
- Konu secimi (`/api/konu`)
- Soru getirme (`/api/sorular`)
- Quiz submit ve sonuc (`/api/quiz/submit`)
- Deneme sinavlari listesi ve cozumu (`/api/deneme-sinavi`, `/api/deneme-sinavlari/{id}/quiz-sorular`)
- Raporlar listesi (`/api/raporlar`)
- Profil goruntuleme/guncelleme (`/api/users/me`)
- Gamification ozet ekrani (raporlardan XP/altin/seviye)

## Sonraki Adimlar

- Grafiklerim
- Flashcard
- Ders detay + video notes
- Push bildirimleri ve offline cache
