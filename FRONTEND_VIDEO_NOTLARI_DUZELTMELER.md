# Frontend Video Notları Düzeltmeleri

## Yapılan Düzeltmeler

### 1. Zaman Damgası Takibi Düzeltmeleri

#### Sorun
- Birden fazla video olduğunda zaman damgası doğru video için güncellenmiyordu
- YouTube player interval'leri doğru videoId ile eşleşmiyordu
- Normal video element'lerde event listener'lar doğru çalışmıyordu

#### Çözüm

**YouTube Player Zaman Damgası Takibi:**
- `selectedVideo?.videoId` kontrolü yerine `selectedVideo?.videoId || selectedVideo?.konuId` kullanıldı
- Interval'ler her video için ayrı tutuluyor ve doğru videoId ile eşleştiriliyor
- Mevcut interval'ler temizleniyor (memory leak önleme)

**Normal Video Element Zaman Damgası Takibi:**
- `timeupdate`, `play`, `pause` event listener'ları eklendi
- Zaman damgası kontrolü `currentVideoId === videoId` şeklinde yapılıyor

### 2. Not Ekleme Düzeltmeleri

#### Sorun
- Backend'e gönderilen `videoId` formatı yanlıştı
- `videoId` ve `videoUrl` karışıyordu
- Backend'den gelen notlar doğru filtrelenmiyordu

#### Çözüm

**Not Ekleme (handleAddNote):**
- `videoId` varsa ve `videoUrl`'den farklıysa kullanılıyor
- Backend'e gönderilen `noteData` içinde `videoId` doğru formatlanıyor
- Backend'den gelen notlar `videoId` veya `videoUrl`'e göre filtreleniyor
- Hata durumunda localStorage fallback'i çalışıyor

**Not Yükleme (loadNotes):**
- Backend'den gelen notlar `videoId` veya `videoUrl`'e göre filtreleniyor
- Eğer `videoId` varsa, sadece o `videoId`'ye ait notlar gösteriliyor
- Eğer `videoId` yoksa, `videoUrl`'e göre filtreleme yapılıyor

### 3. Zaman Damgası Güncelleme Düzeltmeleri

**VideoNotes Component:**
- `currentTime` prop'u kontrol ediliyor (NaN, undefined kontrolü)
- Zaman damgası sadece geçerli değerler için güncelleniyor

## Kod Değişiklikleri

### DersDetay.jsx

1. **YouTube Player Interval Temizleme:**
```javascript
// Mevcut interval'i temizle (eğer varsa)
if (youtubeTimeInterval.current[videoId]) {
  clearInterval(youtubeTimeInterval.current[videoId]);
}
```

2. **VideoId Kontrolü:**
```javascript
const currentVideoId = selectedVideo?.videoId || selectedVideo?.konuId;
if (currentVideoId === videoId && videoNotesOpen) {
  setVideoCurrentTime(seconds);
}
```

3. **Normal Video Element Event Listener'ları:**
```javascript
const updateVideoTime = () => {
  const currentVideoId = selectedVideo?.videoId || selectedVideo?.konuId;
  if (currentVideoId === videoId && videoNotesOpen) {
    setVideoCurrentTime(Math.floor(el.currentTime));
  }
};

el.addEventListener('timeupdate', updateVideoTime);
el.addEventListener('play', updateVideoTime);
el.addEventListener('pause', updateVideoTime);
```

### VideoNotes.jsx

1. **Not Ekleme:**
```javascript
const finalVideoId = videoId && videoId !== videoUrl ? videoId : null;

const noteData = {
  konuId,
  ...(finalVideoId && { videoId: finalVideoId }), // videoId varsa ekle
  videoUrl,
  noteText: newNoteText.trim(),
  timestampSeconds: newNoteTimestamp || 0
};
```

2. **Not Filtreleme:**
```javascript
const noteVideoId = newNote.videoId || newNote.video_id;
const noteVideoUrl = newNote.videoUrl || newNote.video_url;

if ((finalVideoId && noteVideoId === finalVideoId) || 
    (!finalVideoId && noteVideoUrl === videoUrl)) {
  setNotes([...notes, newNote].sort(...));
}
```

3. **Zaman Damgası Güncelleme:**
```javascript
useEffect(() => {
  if (typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0) {
    setNewNoteTimestamp(Math.floor(currentTime));
  }
}, [currentTime]);
```

## Test Senaryoları

### 1. Zaman Damgası Takibi
- ✅ Birden fazla video olan konuda, seçili video için zaman damgası güncellenmeli
- ✅ YouTube videoları için zaman damgası doğru çalışmalı
- ✅ Normal video element'leri için zaman damgası doğru çalışmalı
- ✅ Video notları kapalıyken zaman damgası sıfırlanmalı

### 2. Not Ekleme
- ✅ Birden fazla video olan konuda, notlar doğru videoId ile kaydedilmeli
- ✅ Backend'e gönderilen `videoId` formatı doğru olmalı
- ✅ Backend'den gelen notlar doğru filtrelenmeli
- ✅ localStorage fallback'i çalışmalı

### 3. Not Görüntüleme
- ✅ Her video için ayrı notlar gösterilmeli
- ✅ Eski notlar (videoUrl'e göre) görünmeye devam etmeli
- ✅ Notlar zaman damgasına göre sıralanmalı

## Backend Gereksinimleri

Backend'de yapılması gerekenler için `BACKEND_VIDEO_NOTLARI_VIDEO_ID.md` dosyasına bakın.

### Önemli Noktalar

1. **videoId Formatı:**
   - Frontend'den gelen format: `"konuId_videoIndex"` (örn: "123_0", "123_1")
   - Backend bu formatı kabul etmeli ve saklamalı

2. **Geriye Dönük Uyumluluk:**
   - Eğer `videoId` yoksa, `videoUrl` kullanılmalı
   - Eski notlar `videoUrl`'e göre görünmeye devam etmeli

3. **API Endpoint'leri:**
   - `GET /api/video-notes?konuId=X&videoId=Y` - videoId'ye göre filtreleme
   - `POST /api/video-notes` - videoId ile not kaydetme

