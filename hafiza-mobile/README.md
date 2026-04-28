# Hafiza Mobile

Bu proje, `hafiza-web` ile ayni backend'e baglanan Expo tabanli mobil uygulama MVP'sidir.

## Kurulum

```bash
npm install
```

## API Ayari

`.env` dosyasi olustur:

```bash
# Fiziksel telefon (onerilen): bilgisayarin LAN IP + backend portu
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080
```

Notlar:
- Otomatik Metro IP + port: varsayilan backend portu **8080** (Spring). Backend **8085** ise `.env` icine `EXPO_PUBLIC_API_PORT=8085` veya tam URL yazin.
- Android emulator icin genelde: `http://10.0.2.2:8080` (veya `localhost` — kod10.0.2.2'ye cevirir)
- Fiziksel cihazda `localhost` kullanmayin; telefon kendi kendisine baglanir.
- Backend CORS tarafinda mobil origin'e izin gerekmiyor; native app origin'siz calisir.
- `.env` degistirdikten sonra Metro'yu yeniden baslatin (`npm start`).

## Calistirma

```bash
npm start
```

Telefon ile ayni Wi‑Fi'de degilsen veya QR acilmiyorsa:

```bash
npm run start:tunnel
```

Metro onbellegi bozulduysa:

```bash
npm run start:clear
```

veya:

```bash
npm run android
npm run ios
npm run web
```

### Expo Go ile telefonda acilmiyorsa

1. **Expo Go surumu**: Bu proje Expo SDK **54** kullanir. App Store / Play Store'dan Expo Go'yu guncelleyin; eski surum "incompatible project" der.
2. **Fiziksel cihaz + backend**: `.env` icinde `localhost` kullanmayin. Bilgisayarinizin LAN IP'sini yazin, ornek: `EXPO_PUBLIC_API_URL=http://192.168.1.10:8080` (backend hangi portta ise).
3. **Baglanti**: `npm run start:tunnel` deneyin; kurumsal ag / VPN Metro'ya engel olabiliyor.
4. **Port mesaji**: Baska terminalde 8081 kullaniliyorsa Expo baska port sorar; `CI=1 expo start --port 8099` ile sabit port verebilirsiniz.

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
