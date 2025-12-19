// src/DersDetay.jsx
import { useEffect, useState, useRef } from "react";
import api, { fileUrl } from "./services/api";
import VideoNotes from "./VideoNotes";
import "./DersDetay.css";

export default function DersDetay({ ders, onBack, initialTab, scrollToKonuId, me }) {
  const [konular, setKonular] = useState([]);
  const [aktifTab, setAktifTab] = useState(initialTab || "konular");
  const [loading, setLoading] = useState(true);
  
  // PDF Modal state
  const [pdfModal, setPdfModal] = useState({
    isOpen: false,
    url: null,
    adi: null
  });

  // Video Notes state
  const [videoNotesOpen, setVideoNotesOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const videoRefs = useRef({});
  const youtubeTimeInterval = useRef({}); // Her konu için ayrı interval
  const youtubePlayers = useRef({}); // YouTube player instances
  const youtubeTimeInputs = useRef({}); // Her konu için input referansları

  // YouTube iframe zaman damgası takibi - Player onReady'de başlatılıyor
  useEffect(() => {
    if (!videoNotesOpen || !selectedVideo) {
      // Video notları kapalıysa zaman damgasını sıfırla
      setVideoCurrentTime(0);
      return;
    }
    
    // Birden fazla video varsa videoId kullan, yoksa konuId kullan (geriye dönük uyumluluk)
    const videoId = selectedVideo.videoId || selectedVideo.konuId;
    
    // YouTube player varsa zaman damgası takibi yap
    if (youtubePlayers.current[videoId]) {
      const player = youtubePlayers.current[videoId];
      
      // Her 500ms'de bir zaman damgası güncelle
      const intervalId = setInterval(() => {
        try {
          if (player && typeof player.getCurrentTime === 'function') {
            const currentTime = player.getCurrentTime();
            if (typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0) {
              setVideoCurrentTime(Math.floor(currentTime));
            }
          }
        } catch (e) {
          console.warn("YouTube zaman damgası alınamadı:", e);
        }
      }, 500);

      // İlk zaman damgasını al
      try {
        if (player && typeof player.getCurrentTime === 'function') {
          const currentTime = player.getCurrentTime();
          if (typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0) {
            setVideoCurrentTime(Math.floor(currentTime));
          }
        }
      } catch (e) {
        // Hata olursa sessizce devam et
      }

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    } else {
      // Player henüz oluşturulmadıysa, oluşturulmasını bekle
      const checkPlayer = setInterval(() => {
        if (youtubePlayers.current[videoId]) {
          clearInterval(checkPlayer);
          // Player oluşturuldu, useEffect tekrar çalışacak
        }
      }, 500);

      // 10 saniye sonra timeout
      setTimeout(() => {
        clearInterval(checkPlayer);
      }, 10000);

      return () => {
        clearInterval(checkPlayer);
      };
    }
  }, [videoNotesOpen, selectedVideo]);

  // Normal video element için zaman damgası takibi
  useEffect(() => {
    if (videoNotesOpen && selectedVideo) {
      // Birden fazla video varsa videoId kullan, yoksa konuId kullan (geriye dönük uyumluluk)
      const videoId = selectedVideo.videoId || selectedVideo.konuId;
      const videoElement = videoRefs.current[videoId];
      
      if (videoElement && videoElement.tagName === 'VIDEO') {
        // Normal video element için zaman damgası takibi
        const updateTime = () => {
          if (videoElement) {
            setVideoCurrentTime(Math.floor(videoElement.currentTime));
          }
        };

        videoElement.addEventListener('timeupdate', updateTime);
        videoElement.addEventListener('play', updateTime);
        videoElement.addEventListener('pause', updateTime);
        videoElement.addEventListener('seeked', updateTime);

        // İlk zaman damgasını al
        updateTime();

        return () => {
          videoElement.removeEventListener('timeupdate', updateTime);
          videoElement.removeEventListener('play', updateTime);
          videoElement.removeEventListener('pause', updateTime);
          videoElement.removeEventListener('seeked', updateTime);
        };
      }
    } else {
      // Video notları kapalıysa zaman damgasını sıfırla
      setVideoCurrentTime(0);
    }
  }, [videoNotesOpen, selectedVideo]);

  // YouTube API ready callback - API yüklendiğinde tüm player'ları oluştur
  useEffect(() => {
    const initYouTubePlayers = () => {
      if (typeof window.YT === 'undefined' || typeof window.YT.Player === 'undefined') {
        return;
      }

      // Tüm YouTube videoları için player'ları oluştur
      konular.forEach((k) => {
        const videoList = k.videolar && k.videolar.length > 0 
          ? k.videolar 
          : (k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url)
            ? [{ 
                id: k.id, 
                videoUrl: k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url,
                videoAdi: "Konu Anlatım Videosu"
              }]
            : [];
        
        videoList.forEach((video, videoIndex) => {
          const videoUrl = video.videoUrl || video.video_url || video.konuAnlatimVideosuUrl || video.konu_anlatim_videosu_url;
          if (!videoUrl || (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be'))) {
            return;
          }

          const videoId = video.id ? String(video.id) : `${k.id}_${videoIndex}`;
          const playerElement = document.getElementById(`youtube-player-${videoId}`);
          
          if (!playerElement || youtubePlayers.current[videoId]) {
            return;
          }

          // YouTube video ID'sini çıkar
          let ytVideoId = null;
          if (videoUrl.includes('youtube.com/watch?v=')) {
            ytVideoId = videoUrl.match(/[?&]v=([^&\n?#]+)/)?.[1];
          } else if (videoUrl.includes('youtu.be/')) {
            ytVideoId = videoUrl.match(/youtu\.be\/([^?\n&#]+)/)?.[1];
          } else if (videoUrl.includes('youtube.com/embed/')) {
            ytVideoId = videoUrl.match(/embed\/([^?&#]+)/)?.[1];
          } else if (videoUrl.includes('youtube.com/v/')) {
            ytVideoId = videoUrl.match(/\/v\/([^?&#]+)/)?.[1];
          }

          if (!ytVideoId) return;

          try {
            const player = new window.YT.Player(`youtube-player-${videoId}`, {
              videoId: ytVideoId,
              playerVars: {
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
                enablejsapi: 1
              },
              events: {
                onReady: (event) => {
                  const player = event.target;
                  
                  if (youtubeTimeInterval.current[videoId]) {
                    clearInterval(youtubeTimeInterval.current[videoId]);
                  }
                  
                  youtubeTimeInterval.current[videoId] = setInterval(() => {
                    try {
                      const currentTime = player.getCurrentTime();
                      if (typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0) {
                        const seconds = Math.floor(currentTime);
                        const currentVideoId = selectedVideo?.videoId || selectedVideo?.konuId;
                        if (currentVideoId === videoId && videoNotesOpen) {
                          setVideoCurrentTime(seconds);
                        }
                      }
                    } catch (e) {
                      // YouTube API çalışmıyor, sessizce devam et
                    }
                  }, 500);
                  
                  try {
                    const currentTime = player.getCurrentTime();
                    if (typeof currentTime === 'number' && !isNaN(currentTime)) {
                      const currentVideoId = selectedVideo?.videoId || selectedVideo?.konuId;
                      if (currentVideoId === videoId && videoNotesOpen) {
                        setVideoCurrentTime(Math.floor(currentTime));
                      }
                    }
                  } catch (e) {
                    // Hata olursa sessizce devam et
                  }
                },
                onStateChange: (event) => {
                  if (event.data === 1) { // PLAYING
                    saveVideoActivity({ ...k, videoAdi: video.videoAdi || video.video_adi || `Video ${videoIndex + 1}` });
                  }
                }
              }
            });
            
            youtubePlayers.current[videoId] = player;
            console.log("YouTube Player önceden yüklendi:", videoId);
          } catch (e) {
            console.warn("YouTube Player oluşturulamadı:", videoId, e);
          }
        });
      });
    };

    // YouTube API yüklendiğinde callback
    if (typeof window.onYouTubeIframeAPIReady === 'undefined') {
      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube API hazır, player'lar oluşturuluyor...");
        setTimeout(initYouTubePlayers, 50);
      };
    }

    // Eğer API zaten yüklendiyse hemen çalıştır
    if (typeof window.YT !== 'undefined' && typeof window.YT.Player !== 'undefined') {
      setTimeout(initYouTubePlayers, 50);
    }

    // Konular değiştiğinde de player'ları oluştur
    if (konular.length > 0) {
      setTimeout(initYouTubePlayers, 100);
    }
  }, [konular, selectedVideo, videoNotesOpen]);

  useEffect(() => {
    if (ders?.id) {
      fetchKonular();
    }
  }, [ders]);
  
  // Video tab'ına geçildiyse ve scrollToKonuId varsa, o konuya scroll et
  useEffect(() => {
    if (aktifTab === "videolar" && scrollToKonuId && konular.length > 0) {
      setTimeout(() => {
        const videoWrapper = document.querySelector(`[data-konu-id="${scrollToKonuId}"]`);
        if (videoWrapper) {
          videoWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Kartı vurgula
          videoWrapper.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.5)';
          videoWrapper.style.borderRadius = '12px';
          setTimeout(() => {
            videoWrapper.style.boxShadow = '';
          }, 2000);
        }
      }, 300);
    }
    
    // Konular tab'ına geçildiyse ve scrollToKonuId varsa, o konuya scroll et
    if (aktifTab === "konular" && scrollToKonuId && konular.length > 0) {
      setTimeout(() => {
        const konuCard = document.querySelector(`.konu-card[data-konu-id="${scrollToKonuId}"]`);
        if (konuCard) {
          konuCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Kartı vurgula
          konuCard.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.5)';
          konuCard.style.borderRadius = '12px';
          setTimeout(() => {
            konuCard.style.boxShadow = '';
          }, 2000);
        }
      }, 300);
    }
  }, [aktifTab, scrollToKonuId, konular]);

  const fetchKonular = async () => {
    try {
      const { data } = await api.get("/api/konu", { params: { dersId: ders.id } });
      setKonular(data || []);
    } catch {
      setKonular([]);
    } finally {
      setLoading(false);
    }
  };

  // Video'lu konuları filtrele (yeni video listesi veya eski tek video)
  const videolar = konular.filter(k => 
    (k.videolar && k.videolar.length > 0) || 
    k.konuAnlatimVideosuUrl || 
    k.konu_anlatim_videosu_url || 
    k.videoUrl || 
    k.video_url
  );

  // PDF okuma aktivitesi kaydet
  const savePdfActivity = async (konu) => {
    // Aynı konu için birden fazla kez kayıt yapma
    const activityKey = `pdf_${konu?.id}`;
    if (savedPdfActivities.current.has(activityKey)) {
      return;
    }
    
    const dersAd = ders?.ad || "Bilinmeyen Ders";
    const konuAd = konu?.ad || "Bilinmeyen Konu";
    const activityData = {
      activityType: "konu_calisma",
      activityTitle: `${dersAd} > ${konuAd} - Konu Anlatım Dökümanı`,
      activitySubtitle: konu?.aciklama || konuAd || "Konu Anlatım Dökümanı",
      activityIcon: "book",
      dersId: ders?.id,
      konuId: konu?.id,
      createdAt: new Date().toISOString(),
      metadata: {
        dokumanUrl: konu.dokumanUrl || konu.dokuman_url,
        dokumanAdi: konu.dokumanAdi || konu.dokuman_adi || konu.ad
      }
    };
    
    try {
      // Backend'e kaydet
      await api.post("/api/activities", activityData);
      console.log("PDF aktivitesi backend'e kaydedildi:", activityData);
    } catch (error) {
      console.error("PDF aktivitesi backend'e kaydedilemedi:", error);
      // Backend yoksa localStorage'a kaydet (fallback - kullanıcıya özel)
      try {
        // Kullanıcı ID'sini al
        const userId = me?.id || "guest";
        const storageKey = `pdfActivities_${userId}`;
        const savedActivities = JSON.parse(localStorage.getItem(storageKey) || "[]");
        savedActivities.unshift({
          id: `local_pdf_${Date.now()}_${konu?.id}`,
          ...activityData
        });
        // Son 50 aktiviteyi tut
        const limited = savedActivities.slice(0, 50);
        localStorage.setItem(storageKey, JSON.stringify(limited));
        console.log("PDF aktivitesi localStorage'a kaydedildi:", activityData);
      } catch (localError) {
        console.error("PDF aktivitesi localStorage'a kaydedilemedi:", localError);
      }
    }
    
    // Başarılı kayıt sonrası flag'i set et
    savedPdfActivities.current.add(activityKey);
  };

  const openPdfModal = (konu) => {
    setPdfModal({
      isOpen: true,
      url: konu.dokumanUrl || konu.dokuman_url,
      adi: konu.dokumanAdi || konu.dokuman_adi || konu.ad
    });
    
    // PDF açıldığında aktivite kaydet
    savePdfActivity(konu);
  };

  const closePdfModal = () => {
    setPdfModal({
      isOpen: false,
      url: null,
      adi: null
    });
  };

  // Video izleme aktivitesi kaydet (her konu için bir kez)
  const savedVideoActivities = useRef(new Set());
  // PDF okuma aktivitesi kaydet (her konu için bir kez)
  const savedPdfActivities = useRef(new Set());
  
  const saveVideoActivity = async (konu) => {
    // Aynı konu için birden fazla kez kayıt yapma
    const activityKey = `video_${konu?.id}`;
    if (savedVideoActivities.current.has(activityKey)) {
      return;
    }
    
    const dersAd = ders?.ad || "Bilinmeyen Ders";
    const konuAd = konu?.ad || "Bilinmeyen Konu";
    const activityData = {
      activityType: "video_izleme",
      activityTitle: `${dersAd} > ${konuAd} - Konu Anlatım Videosu`,
      activitySubtitle: konu?.aciklama || konuAd || "Konu Anlatım Videosu",
      activityIcon: "video",
      dersId: ders?.id,
      konuId: konu?.id,
      createdAt: new Date().toISOString(),
      metadata: {
        videoUrl: konu.konuAnlatimVideosuUrl || konu.konu_anlatim_videosu_url || konu.videoUrl || konu.video_url
      }
    };
    
    try {
      // Backend'e kaydet
      await api.post("/api/activities", activityData);
      console.log("Video aktivitesi backend'e kaydedildi:", activityData);
    } catch (error) {
      console.error("Video aktivitesi backend'e kaydedilemedi:", error);
      // Backend yoksa localStorage'a kaydet (fallback - kullanıcıya özel)
      try {
        const userId = me?.id || "guest";
        const storageKey = `videoActivities_${userId}`;
        const savedActivities = JSON.parse(localStorage.getItem(storageKey) || "[]");
        savedActivities.unshift({
          id: `local_${Date.now()}_${konu?.id}`,
          ...activityData
        });
        // Son 50 aktiviteyi tut
        const limited = savedActivities.slice(0, 50);
        localStorage.setItem(storageKey, JSON.stringify(limited));
        console.log("Video aktivitesi localStorage'a kaydedildi:", activityData);
      } catch (localError) {
        console.error("Video aktivitesi localStorage'a kaydedilemedi:", localError);
      }
    }
    
    // Başarılı kayıt sonrası flag'i set et
    savedVideoActivities.current.add(activityKey);
  };

  if (loading) return <div className="ders-loading">Ders detayları yükleniyor...</div>;

  return (
    <div className="ders-detay">
      {/* Video Notları Overlay */}
      {videoNotesOpen && (
        <div 
          className="video-notes-overlay"
          onClick={() => {
            setVideoNotesOpen(false);
            setSelectedVideo(null);
          }}
        />
      )}

      <div className="ders-header">
        <h2>{ders.ad}</h2>
        <button onClick={onBack} className="geri-btn">← Geri</button>
      </div>

      <nav className="tablar">
        {["konular", "videolar", "istatistikler"].map((t) => (
          <button
            key={t}
            className={aktifTab === t ? "aktif" : ""}
            onClick={() => setAktifTab(t)}
          >
            {t === "konular" && "Konular"}
            {t === "videolar" && "Videolar"}
            {t === "istatistikler" && "İstatistikler"}
          </button>
        ))}
      </nav>

      <div className="icerik">
        {aktifTab === "konular" && (
          <div className="konu-listesi">
            {konular.map((k) => (
              <div key={k.id} className="konu-card" data-konu-id={k.id}>
                <div className="konu-card-header">
                  <h4>{k.ad}</h4>
                  {(k.dokumanUrl || k.dokuman_url) && (
                    <span className="dokuman-badge">PDF Var</span>
                  )}
                </div>
                <p>{k.aciklama || "Açıklama yakında"}</p>
                <div className="konu-actions">
                  {(k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url) && (
                    <button 
                      className="konu-btn primary"
                      onClick={() => {
                        setAktifTab("videolar");
                        // Video kartını scroll et (video ID ile)
                        setTimeout(() => {
                          const videoWrapper = document.querySelector(`[data-konu-id="${k.id}"]`);
                          if (videoWrapper) {
                            videoWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Kartı vurgula
                            videoWrapper.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.5)';
                            videoWrapper.style.borderRadius = '12px';
                            setTimeout(() => {
                              videoWrapper.style.boxShadow = '';
                            }, 2000);
                          }
                        }, 100);
                      }}
                    >
                      Konu Anlatım Videosuna Git
                    </button>
                  )}
                  {(k.dokumanUrl || k.dokuman_url) && (
                    <button 
                      className="konu-btn secondary"
                      onClick={() => openPdfModal(k)}
                    >
                      Konu Anlatıma Git
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {aktifTab === "videolar" && (
          <div className="video-section">
            {videolar.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {videolar.map((k) => {
                  // Yeni video listesi varsa kullan, yoksa eski tek video'yu kullan
                  const videoList = k.videolar && k.videolar.length > 0 
                    ? k.videolar 
                    : (k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url)
                      ? [{ 
                          id: k.id, 
                          videoUrl: k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url,
                          videoAdi: "Konu Anlatım Videosu"
                        }]
                      : [];
                  
                  if (videoList.length === 0) return null;
                  
                  // Her video için ayrı kart oluştur
                  return videoList
                    .sort((a, b) => {
                      // Sıralamaya göre sırala (eğer varsa)
                      const siralamaA = a.siralama || a.sira || 0;
                      const siralamaB = b.siralama || b.sira || 0;
                      return siralamaA - siralamaB;
                    })
                    .map((video, videoIndex) => {
                      const videoUrl = video.videoUrl || video.video_url || video.konuAnlatimVideosuUrl || video.konu_anlatim_videosu_url;
                      if (!videoUrl) return null;
                      
                      // Backend'den gelen video.id'yi kullan (sayı formatında: 1, 3, 4)
                    // Eğer yoksa, fallback olarak "konuId_videoIndex" formatını kullan
                    const videoId = video.id ? String(video.id) : `${k.id}_${videoIndex}`;
                      
                      // Video adını belirle: backend'den gelen ad varsa ve benzersizse kullan, yoksa index'e göre oluştur
                      let videoAdi = video.videoAdi || video.video_adi;
                      
                      // Eğer video adı yoksa, boşsa veya "Video" ile başlayıp sayı içeriyorsa, index'e göre oluştur
                      // (Backend'den gelen video adları genellikle "Video 1" formatında geliyor ve hepsi aynı olabiliyor)
                      if (!videoAdi || videoAdi.trim() === "" || videoAdi.match(/^Video\s*\d+$/i)) {
                        // Index + 1 kullan (çünkü index 0'dan başlar)
                        videoAdi = videoList.length > 1 ? `Video ${videoIndex + 1}` : k.ad;
                      }
                    
                    // YouTube URL'ini tespit et ve embed formatına çevir
                    const isYoutubeVideo = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
                    let finalVideoUrlValue = videoUrl;
                    let isYoutubeEmbedValue = false;
                    
                    if (isYoutubeVideo) {
                    // YouTube URL'ini embed formatına çevir
                      let youtubeId = null;
                      
                      // Farklı YouTube URL formatlarını destekle
                      if (videoUrl.includes('youtube.com/watch?v=')) {
                        youtubeId = videoUrl.match(/[?&]v=([^&\n?#]+)/)?.[1];
                      } else if (videoUrl.includes('youtu.be/')) {
                        youtubeId = videoUrl.match(/youtu\.be\/([^?\n&#]+)/)?.[1];
                      } else if (videoUrl.includes('youtube.com/embed/')) {
                        youtubeId = videoUrl.match(/embed\/([^?\n&#]+)/)?.[1];
                        isYoutubeEmbedValue = true; // Zaten embed formatında
                      } else if (videoUrl.includes('youtube.com/v/')) {
                        youtubeId = videoUrl.match(/\/v\/([^?\n&#]+)/)?.[1];
                      }
                      
                    if (youtubeId) {
                        // YouTube embed URL'ini oluştur
                        // enablejsapi=1: JavaScript API'yi etkinleştir (zaman damgası takibi için gerekli)
                        // origin: Güvenlik için origin belirt
                        const origin = encodeURIComponent(window.location.origin);
                        finalVideoUrlValue = `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${origin}`;
                        isYoutubeEmbedValue = true;
                      } else {
                        // YouTube URL'i tespit edildi ama ID çıkarılamadı
                        console.warn("YouTube URL'i tespit edildi ancak video ID çıkarılamadı:", videoUrl);
                      }
                    } else {
                      // YouTube değilse, dosya yolu kontrolü yap
                      finalVideoUrlValue = videoUrl.startsWith('/files/') 
                        ? fileUrl(videoUrl) 
                        : videoUrl;
                  }
                  
                  return (
                      <div key={videoId} className="video-konu-wrapper" data-konu-id={k.id} data-video-id={videoId}>
                      <div style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '16px 24px',
                        borderRadius: '12px 12px 0 0',
                        marginBottom: '0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                              {videoList.length > 1 ? `${k.ad} - ${videoAdi}` : k.ad}
                            </h3>
                            {k.aciklama && videoList.length === 1 && (
                            <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>{k.aciklama}</p>
                          )}
                            {videoList.length > 1 && (
                              <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.8 }}>{videoAdi}</p>
                            )}
                        </div>
                        <button
                          className="video-notes-toggle-btn"
                          onClick={() => {
                              setSelectedVideo({ konuId: k.id, videoId: videoId, videoUrl: finalVideoUrlValue });
                            setVideoNotesOpen(true);
                          }}
                          title="Notları aç"
                          style={{ 
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '0.9rem'
                          }}
                        >
                          📝 Notlar
                        </button>
                      </div>
                      <div className="video-card" style={{ 
                        borderRadius: '0 0 12px 12px',
                        padding: '0',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                          {isYoutubeEmbedValue ? (
                            <div className="youtube-container" style={{ position: 'relative' }}>
                              <div 
                                id={`youtube-player-${videoId}`}
                                style={{ width: '100%', height: '400px' }}
                              ></div>
                          <iframe
                            ref={(el) => {
                                  if (el) {
                                    videoRefs.current[videoId] = el;
                                    // iframe yüklendiğinde hemen player oluştur
                                    const initPlayer = () => {
                                      if (typeof window.YT === 'undefined' || typeof window.YT.Player === 'undefined') {
                                        // YouTube API henüz yüklenmediyse, daha kısa aralıklarla kontrol et
                                        setTimeout(initPlayer, 100);
                                        return;
                                      }

                                      const videoIdMatch = finalVideoUrlValue.match(/embed\/([^?&#]+)/);
                                      if (!videoIdMatch) return;

                                      const ytVideoId = videoIdMatch[1];
                                      
                                      try {
                                        if (!youtubePlayers.current[videoId]) {
                                          const player = new window.YT.Player(`youtube-player-${videoId}`, {
                                            videoId: ytVideoId,
                                            playerVars: {
                                              rel: 0,
                                              modestbranding: 1,
                                              playsinline: 1,
                                              enablejsapi: 1
                                            },
                                            events: {
                                              onReady: (event) => {
                                                const player = event.target;
                                                
                                                // Mevcut interval'i temizle (eğer varsa)
                                                if (youtubeTimeInterval.current[videoId]) {
                                                  clearInterval(youtubeTimeInterval.current[videoId]);
                                                }
                                                
                                              // Her 500ms'de bir zaman damgası güncelle
                                              // Mevcut interval'i temizle (eğer varsa)
                                              if (youtubeTimeInterval.current[videoId]) {
                                                clearInterval(youtubeTimeInterval.current[videoId]);
                                              }
                                              
                                              youtubeTimeInterval.current[videoId] = setInterval(() => {
                                                try {
                                                  const currentTime = player.getCurrentTime();
                                                  if (typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0) {
                                                    const seconds = Math.floor(currentTime);
                                                    // Video notları açıksa ve bu video seçiliyse zaman damgasını güncelle
                                                    // selectedVideo kontrolü için videoId veya konuId kullan
                                                    const currentVideoId = selectedVideo?.videoId || selectedVideo?.konuId;
                                                    if (currentVideoId === videoId && videoNotesOpen) {
                                                      setVideoCurrentTime(seconds);
                                                    }
                                                  }
                                                } catch (e) {
                                                  // YouTube API çalışmıyor, sessizce devam et
                                                }
                                              }, 500);
                                              
                                              // İlk zaman damgasını al
                                              try {
                                                const currentTime = player.getCurrentTime();
                                                if (typeof currentTime === 'number' && !isNaN(currentTime)) {
                                                  const currentVideoId = selectedVideo?.videoId || selectedVideo?.konuId;
                                                  if (currentVideoId === videoId && videoNotesOpen) {
                                                    setVideoCurrentTime(Math.floor(currentTime));
                                                  }
                                                }
                                              } catch (e) {
                                                // Hata olursa sessizce devam et
                                              }
                                                
                                                console.log("YouTube Player hazır, zaman damgası takibi başlatıldı:", videoId);
                                              },
                                              onStateChange: (event) => {
                                                // Video durumu değiştiğinde log (debug için)
                                                console.log("YouTube video durumu:", event.data);
                                                
                                                // Video oynatılmaya başlandığında aktivite kaydet (sadece bir kez)
                                                // YT.PlayerState.PLAYING = 1
                                                if (event.data === 1) {
                                                  saveVideoActivity({ ...k, videoAdi: videoAdi });
                                                }
                                              }
                                            }
                                          });
                                          
                                          youtubePlayers.current[videoId] = player;
                                          console.log("YouTube Player oluşturuldu:", videoId, ytVideoId);
                                        }
                                      } catch (e) {
                                        console.error("YouTube Player oluşturulamadı:", e);
                                      }
                                    };
                                    
                                    // Hemen player oluşturmayı dene (iframe yüklenmeden önce)
                                    initPlayer();
                                  }
                            }}
                                src={finalVideoUrlValue}
                                title={videoAdi}
                            allowFullScreen
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                loading="eager"
                                style={{ display: 'none' }}
                          ></iframe>
                              
                              {/* YouTube için zaman damgası kontrolü - Elle yüklenen videolar gibi */}
                              {((selectedVideo?.videoId || selectedVideo?.konuId) === videoId && videoNotesOpen) && (
                                <div style={{
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  padding: '12px 16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  color: 'white',
                                  fontSize: '14px',
                                  fontWeight: 600
                                }}>
                                  <span>⏱️ Zaman:</span>
                                  <input
                                    ref={(el) => {
                                      if (el) youtubeTimeInputs.current[videoId] = el;
                                    }}
                                    type="number"
                                    data-youtube-time={videoId}
                                    min="0"
                                    step="1"
                                    value={videoCurrentTime}
                                    onChange={(e) => {
                                      const seconds = parseInt(e.target.value) || 0;
                                      setVideoCurrentTime(seconds);
                                    }}
                                    onBlur={(e) => {
                                      const seconds = parseInt(e.target.value) || 0;
                                      setVideoCurrentTime(seconds);
                                      // Video'yu bu zamana götür
                                      const player = youtubePlayers.current[videoId];
                                      if (player && typeof player.seekTo === 'function') {
                                        player.seekTo(seconds, true);
                                      }
                                    }}
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.2)',
                                      border: '1px solid rgba(255, 255, 255, 0.3)',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      color: 'white',
                                      fontSize: '14px',
                                      fontWeight: 600,
                                      width: '80px',
                                      textAlign: 'center'
                                    }}
                                    placeholder="0"
                                  />
                                  <span>saniye</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Şu anki zamanı al (YouTube Player'dan)
                                      const player = youtubePlayers.current[videoId];
                                      if (player && typeof player.getCurrentTime === 'function') {
                                        try {
                                          const currentTime = player.getCurrentTime();
                                          if (typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0) {
                                            const seconds = Math.floor(currentTime);
                                            setVideoCurrentTime(seconds);
                                          }
                                        } catch (e) {
                                          console.warn("YouTube zaman damgası alınamadı:", e);
                                        }
                                      }
                                    }}
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.3)',
                                      border: '1px solid rgba(255, 255, 255, 0.4)',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      color: 'white',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.background = 'rgba(255, 255, 255, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                                    }}
                                  >
                                    🔄 Şu Anki Zamanı Al
                                  </button>
                                </div>
                              )}
                            </div>
                        ) : (
                          <video 
                            ref={(el) => {
                              if (el) {
                                  videoRefs.current[videoId] = el;
                                // Video zaman damgasını takip et
                                const updateVideoTime = () => {
                                  const currentVideoId = selectedVideo?.videoId || selectedVideo?.konuId;
                                  if (currentVideoId === videoId && videoNotesOpen) {
                                    setVideoCurrentTime(Math.floor(el.currentTime));
                                  }
                                };
                                
                                el.addEventListener('timeupdate', updateVideoTime);
                                el.addEventListener('play', updateVideoTime);
                                el.addEventListener('pause', updateVideoTime);
                              }
                            }}
                              src={finalVideoUrlValue} 
                            controls 
                            preload="auto"
                            loading="eager"
                            fetchpriority="high"
                            style={{ width: '100%', height: '400px', display: 'block' }}
                            onEnded={() => {
                              // Video tamamen izlendiğinde aktivite kaydet
                                saveVideoActivity({ ...k, videoAdi: videoAdi });
                            }}
                            onPlay={() => {
                              // Video oynatılmaya başlandığında kaydet (sadece bir kez)
                                saveVideoActivity({ ...k, videoAdi: videoAdi });
                            }}
                          >
                            Tarayıcınız video oynatmayı desteklemiyor.
                          </video>
                        )}
                      </div>
                    </div>
                  );
                  });
                }).flat()}
              </div>
            ) : (
              <div className="empty-state" style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '16px', color: '#6b7280' }}>Henüz konu anlatım videosu eklenmemiş</p>
              </div>
            )}
          </div>
        )}

        {/* Video Notları Panel */}
        {videoNotesOpen && selectedVideo && (
          <VideoNotes
            konuId={selectedVideo.konuId}
            videoId={selectedVideo.videoId} // Fallback yok! videoId varsa onu kullan, yoksa undefined
            videoUrl={selectedVideo.videoUrl}
            currentTime={videoCurrentTime}
            onSeekTo={(timestamp) => {
              // Video'yu belirtilen zamana götür
              // Birden fazla video varsa videoId kullan, yoksa konuId kullan (geriye dönük uyumluluk)
              const videoId = selectedVideo.videoId || selectedVideo.konuId;
              const videoElement = videoRefs.current[videoId];
              if (videoElement) {
                if (videoElement.tagName === 'VIDEO') {
                  videoElement.currentTime = timestamp;
                  videoElement.play();
                } else if (videoElement.tagName === 'IFRAME') {
                  // YouTube iframe için player API kullan
                  const player = youtubePlayers.current[videoId];
                  if (player && typeof player.seekTo === 'function') {
                    player.seekTo(timestamp, true);
                  }
                }
              }
            }}
            isOpen={videoNotesOpen}
            onClose={() => {
              setVideoNotesOpen(false);
              setSelectedVideo(null);
            }}
            me={me}
          />
        )}

        {aktifTab === "istatistikler" && (
          <div className="istatistikler">
            <h4>İstatistikler - {ders.ad}</h4>
            <ul>
              <li>Toplam Konu: {konular.length}</li>
              <li>Doğruluk Oranı: %87</li>
              <li>Ortalama Süre: 12dk</li>
            </ul>
          </div>
        )}
      </div>

      {/* PDF Modal */}
      {pdfModal.isOpen && (
        <div className="pdf-modal-overlay" onClick={closePdfModal}>
          <div className="pdf-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-modal-header">
              <h3>{pdfModal.adi}</h3>
              <button className="pdf-modal-close" onClick={closePdfModal}>
                ✕
              </button>
            </div>
            <div className="pdf-modal-body">
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '24px',
                padding: '40px'
              }}>
                <h3 style={{ fontSize: '1.5rem', color: '#111827', margin: 0 }}>
                  {pdfModal.adi}
                </h3>
                <p style={{ color: '#6b7280', textAlign: 'center', maxWidth: '500px' }}>
                  PDF dökümanı görüntülemek için aşağıdaki butona tıklayın.
                  Döküman yeni sekmede açılacaktır.
                </p>
                <a 
                  href={fileUrl(pdfModal.url)} 
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '16px 48px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '12px',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    boxShadow: '0 8px 20px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.3s',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(102, 126, 234, 0.5)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
                  }}
                >
                  PDF'i Görüntüle
                </a>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                  Dosya boyutu değişiklik gösterebilir
                </p>
              </div>
            </div>
            <div className="pdf-modal-footer">
              <a 
                href={fileUrl(pdfModal.url)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="pdf-download-btn"
              >
                PDF'i İndir
              </a>
              <button onClick={closePdfModal} className="pdf-close-btn">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
