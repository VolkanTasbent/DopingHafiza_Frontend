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
  const youtubeTimeInterval = useRef(null);

  // YouTube iframe zaman damgası takibi
  useEffect(() => {
    if (videoNotesOpen && selectedVideo) {
      const videoElement = videoRefs.current[selectedVideo.konuId];
      if (videoElement && videoElement.tagName === 'IFRAME') {
        // YouTube iframe için zaman damgası takibi
        youtubeTimeInterval.current = setInterval(() => {
          try {
            videoElement.contentWindow.postMessage(
              JSON.stringify({ event: 'listening', id: 'video-notes' }),
              '*'
            );
          } catch (e) {
            // Cross-origin hatası olabilir, sessizce devam et
          }
        }, 1000);

        // YouTube'dan gelen zaman damgası mesajlarını dinle
        const handleMessage = (event) => {
          if (event.data && typeof event.data === 'string') {
            try {
              const data = JSON.parse(event.data);
              if (data.event === 'onStateChange' && data.info && data.info.currentTime !== undefined) {
                setVideoCurrentTime(data.info.currentTime);
              }
            } catch (e) {
              // Mesaj parse edilemedi, devam et
            }
          }
        };

        window.addEventListener('message', handleMessage);

        return () => {
          if (youtubeTimeInterval.current) {
            clearInterval(youtubeTimeInterval.current);
          }
          window.removeEventListener('message', handleMessage);
        };
      }
    }
  }, [videoNotesOpen, selectedVideo]);

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

  // Video'lu konuları filtrele
  const videolar = konular.filter(k => k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url);

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
                  const videoUrl = k.konuAnlatimVideosuUrl || k.konu_anlatim_videosu_url || k.videoUrl || k.video_url;
                  if (!videoUrl) return null;
                  
                  // Eğer URL bir dosya yolu ise (örn: /files/...)
                  const finalVideoUrl = videoUrl.startsWith('/files/') 
                    ? fileUrl(videoUrl) 
                    : videoUrl;
                  
                  // YouTube embed URL'i mi kontrol et
                  const isYoutubeEmbed = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
                  let embedUrl = finalVideoUrl;
                  
                  if (isYoutubeEmbed) {
                    // YouTube URL'ini embed formatına çevir
                    const youtubeId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
                    if (youtubeId) {
                      embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
                    }
                  }
                  
                  return (
                    <div key={k.id} className="video-konu-wrapper" data-konu-id={k.id}>
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
                          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{k.ad}</h3>
                          {k.aciklama && (
                            <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>{k.aciklama}</p>
                          )}
                        </div>
                        <button
                          className="video-notes-toggle-btn"
                          onClick={() => {
                            setSelectedVideo({ konuId: k.id, videoUrl: finalVideoUrl });
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
                        {isYoutubeEmbed || videoUrl.includes('embed') ? (
                          <iframe
                            ref={(el) => {
                              if (el) videoRefs.current[k.id] = el;
                            }}
                            src={embedUrl}
                            title={k.ad}
                            allowFullScreen
                            style={{ width: '100%', height: '400px', border: 'none', display: 'block' }}
                            onLoad={() => {
                              // YouTube iframe yüklendiğinde aktivite kaydet
                              // Not: YouTube iframe'de tam izlenme tespiti zor, bu yüzden yüklendiğinde kaydediyoruz
                              saveVideoActivity(k);
                            }}
                          ></iframe>
                        ) : (
                          <video 
                            ref={(el) => {
                              if (el) {
                                videoRefs.current[k.id] = el;
                                // Video zaman damgasını takip et
                                el.addEventListener('timeupdate', () => {
                                  if (selectedVideo?.konuId === k.id && videoNotesOpen) {
                                    setVideoCurrentTime(el.currentTime);
                                  }
                                });
                              }
                            }}
                            src={finalVideoUrl} 
                            controls 
                            style={{ width: '100%', height: '400px', display: 'block' }}
                            onEnded={() => {
                              // Video tamamen izlendiğinde aktivite kaydet
                              saveVideoActivity(k);
                            }}
                            onPlay={() => {
                              // Video oynatılmaya başlandığında kaydet (sadece bir kez)
                              saveVideoActivity(k);
                            }}
                          >
                            Tarayıcınız video oynatmayı desteklemiyor.
                          </video>
                        )}
                      </div>
                    </div>
                  );
                })}
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
            videoUrl={selectedVideo.videoUrl}
            currentTime={videoCurrentTime}
            onSeekTo={(timestamp) => {
              // Video'yu belirtilen zamana götür
              const videoElement = videoRefs.current[selectedVideo.konuId];
              if (videoElement) {
                if (videoElement.tagName === 'VIDEO') {
                  videoElement.currentTime = timestamp;
                  videoElement.play();
                } else if (videoElement.tagName === 'IFRAME') {
                  // YouTube iframe için postMessage kullan
                  videoElement.contentWindow.postMessage(
                    JSON.stringify({
                      event: 'command',
                      func: 'seekTo',
                      args: [timestamp, true]
                    }),
                    '*'
                  );
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

        {/* Video Notları Panel */}
        {videoNotesOpen && selectedVideo && (
          <VideoNotes
            konuId={selectedVideo.konuId}
            videoUrl={selectedVideo.videoUrl}
            currentTime={videoCurrentTime}
            onSeekTo={(timestamp) => {
              // Video'yu belirtilen zamana götür
              const videoElement = videoRefs.current[selectedVideo.konuId];
              if (videoElement) {
                if (videoElement.tagName === 'VIDEO') {
                  videoElement.currentTime = timestamp;
                  videoElement.play();
                } else if (videoElement.tagName === 'IFRAME') {
                  // YouTube iframe için postMessage kullan
                  videoElement.contentWindow.postMessage(
                    JSON.stringify({
                      event: 'command',
                      func: 'seekTo',
                      args: [timestamp, true]
                    }),
                    '*'
                  );
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
