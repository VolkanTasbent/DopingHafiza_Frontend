// src/VideoNotes.jsx
import { useState, useEffect, useRef } from "react";
import api from "./services/api";
import "./VideoNotes.css";

export default function VideoNotes({ 
  konuId, 
  videoId, // Birden fazla video için benzersiz video ID
  videoUrl, 
  currentTime = 0, 
  onSeekTo,
  isOpen,
  onClose,
  me
}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteTimestamp, setNewNoteTimestamp] = useState(0);
  const [showAddNote, setShowAddNote] = useState(false);
  const textareaRef = useRef(null);

  // Notları yükle
  useEffect(() => {
    if (konuId && (videoId || videoUrl) && isOpen) {
      loadNotes();
    }
  }, [konuId, videoId, videoUrl, isOpen]);

  // Mevcut zamanı güncelle
  useEffect(() => {
    if (typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0) {
      setNewNoteTimestamp(Math.floor(currentTime));
    }
  }, [currentTime]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      // videoId varsa ve videoUrl'den farklıysa videoId gönder, yoksa videoUrl gönder
      // Backend'den gelen video.id sayı olabilir (1, 3, 4), bu yüzden string'e çevir
      const requestVideoId = videoId && videoId !== videoUrl ? String(videoId) : undefined;
      
      console.log("Not yükleme parametreleri:", { 
        videoId, 
        requestVideoId, 
        videoUrl, 
        konuId 
      });
      
      const response = await api.get("/api/video-notes", {
        params: { 
          konuId, 
          ...(requestVideoId && { videoId: requestVideoId }),
          videoUrl 
        }
      });
      
      console.log("Notlar yüklendi:", response.data);
      console.log("Filtreleme parametreleri:", { requestVideoId, videoId, videoUrl, konuId });
      
      if (response.data?.notes) {
        // Backend'den gelen notları videoId'ye göre filtrele
        // Backend filtreleme yapıyor ama ekstra güvenlik için frontend'de de filtrele
        let filteredNotes = response.data.notes;
        
        if (requestVideoId) {
          // Frontend'de de videoId'ye göre filtrele (ekstra güvenlik)
          filteredNotes = response.data.notes.filter(note => {
            const noteVideoId = note.videoId || note.video_id;
            
            // videoId karşılaştırması: sayı veya string olabilir
            // Backend'den gelen videoId sayı (1, 3, 4), frontend'den gelen videoId string olabilir
            const videoIdMatches = noteVideoId != null && String(noteVideoId) === String(requestVideoId);
            
            return videoIdMatches;
          });
        } else if (videoUrl) {
          // videoId yoksa, videoUrl'e göre filtrele (eski sistem)
          filteredNotes = response.data.notes.filter(note => {
            const noteVideoUrl = note.videoUrl || note.video_url;
            return noteVideoUrl === videoUrl;
          });
        }
        
        console.log("Filtrelenmiş notlar:", filteredNotes);
        console.log("Toplam not sayısı:", response.data.notes.length, "Filtrelenmiş:", filteredNotes.length);
        setNotes(filteredNotes);
      } else {
        console.warn("Backend'den notlar gelmedi veya boş:", response.data);
        setNotes([]);
      }
    } catch (error) {
      console.error("Notlar yüklenemedi:", error);
      // Fallback: localStorage'dan yükle
      loadNotesFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadNotesFromLocalStorage = () => {
    try {
      const userId = me?.id || window.currentUserId || "guest";
      // videoId varsa onu kullan, yoksa videoUrl kullan (geriye dönük uyumluluk)
      const videoIdentifier = videoId || btoa(videoUrl).slice(0, 20);
      const storageKey = `videoNotes_${userId}_${konuId}_${videoIdentifier}`;
      const savedNotes = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setNotes(savedNotes);
    } catch (e) {
      console.error("localStorage'dan notlar yüklenemedi:", e);
    }
  };

  const saveNoteToLocalStorage = (note) => {
    try {
      const userId = me?.id || window.currentUserId || "guest";
      // videoId varsa onu kullan, yoksa videoUrl kullan (geriye dönük uyumluluk)
      const videoIdentifier = videoId || btoa(videoUrl).slice(0, 20);
      const storageKey = `videoNotes_${userId}_${konuId}_${videoIdentifier}`;
      const savedNotes = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const updatedNotes = [...savedNotes, note];
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
    } catch (e) {
      console.error("Not localStorage'a kaydedilemedi:", e);
    }
  };

  const updateNoteInLocalStorage = (noteId, updatedNote) => {
    try {
      const userId = me?.id || window.currentUserId || "guest";
      // videoId varsa onu kullan, yoksa videoUrl kullan (geriye dönük uyumluluk)
      const videoIdentifier = videoId || btoa(videoUrl).slice(0, 20);
      const storageKey = `videoNotes_${userId}_${konuId}_${videoIdentifier}`;
      const savedNotes = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const updatedNotes = savedNotes.map(n => n.id === noteId ? updatedNote : n);
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
    } catch (e) {
      console.error("Not localStorage'da güncellenemedi:", e);
    }
  };

  const deleteNoteFromLocalStorage = (noteId) => {
    try {
      const userId = me?.id || window.currentUserId || "guest";
      // videoId varsa onu kullan, yoksa videoUrl kullan (geriye dönük uyumluluk)
      const videoIdentifier = videoId || btoa(videoUrl).slice(0, 20);
      const storageKey = `videoNotes_${userId}_${konuId}_${videoIdentifier}`;
      const savedNotes = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const updatedNotes = savedNotes.filter(n => n.id !== noteId);
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
    } catch (e) {
      console.error("Not localStorage'dan silinemedi:", e);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) {
      console.warn("Not metni boş!");
      return;
    }

    // videoId varsa onu kullan, yoksa undefined (backend videoUrl'e göre filtreler)
    // videoId formatı: Backend'den gelen video.id (sayı: 1, 3, 4) veya "konuId_videoIndex" (fallback)
    // Backend'e gönderirken string'e çevir (backend sayı olarak kaydediyor olabilir)
    const finalVideoId = videoId && videoId !== videoUrl ? String(videoId) : undefined;

    const noteData = {
      konuId,
      videoId: finalVideoId, // videoId varsa gönder, yoksa undefined (backend görmezden gelir)
      videoUrl,
      noteText: newNoteText.trim(),
      timestampSeconds: newNoteTimestamp || 0
    };

    console.log("Not ekleniyor:", noteData);

    try {
      const response = await api.post("/api/video-notes", noteData);
      const newNote = response.data;
      
      console.log("Backend'den gelen not:", newNote);
      
      // Backend'den gelen notu direkt ekle (backend zaten doğru notu döndürüyor)
      // Backend videoId desteklemiyorsa bile, konuId ve videoUrl'e göre filtreleme yapıyor
      // Bu yüzden backend'den gelen notu direkt ekleyebiliriz
      setNotes([...notes, newNote].sort((a, b) => a.timestampSeconds - b.timestampSeconds));
      setNewNoteText("");
      setShowAddNote(false);
    } catch (error) {
      console.error("Not kaydedilemedi:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      
      // Fallback: localStorage'a kaydet
      const fallbackNote = {
        id: `local_${Date.now()}`,
        ...noteData,
        videoId: finalVideoId || null,
        timestampFormatted: formatTimestamp(newNoteTimestamp || 0),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log("localStorage'a kaydediliyor:", fallbackNote);
      saveNoteToLocalStorage(fallbackNote);
      setNotes([...notes, fallbackNote].sort((a, b) => a.timestampSeconds - b.timestampSeconds));
      setNewNoteText("");
      setShowAddNote(false);
    }
  };

  const handleUpdateNote = async (noteId, updatedText) => {
    try {
      const response = await api.put(`/api/video-notes/${noteId}`, {
        noteText: updatedText
      });
      const updatedNote = response.data;
      setNotes(notes.map(n => n.id === noteId ? updatedNote : n));
      setEditingNoteId(null);
    } catch (error) {
      console.error("Not güncellenemedi:", error);
      // Fallback: localStorage'da güncelle
      const note = notes.find(n => n.id === noteId);
      if (note) {
        const updatedNote = {
          ...note,
          noteText: updatedText,
          updatedAt: new Date().toISOString()
        };
        updateNoteInLocalStorage(noteId, updatedNote);
        setNotes(notes.map(n => n.id === noteId ? updatedNote : n));
        setEditingNoteId(null);
      }
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm("Bu notu silmek istediğinize emin misiniz?")) return;

    try {
      await api.delete(`/api/video-notes/${noteId}`);
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      console.error("Not silinemedi:", error);
      // Fallback: localStorage'dan sil
      deleteNoteFromLocalStorage(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
    }
  };

  const handleExportPdf = async () => {
    try {
      const response = await api.get("/api/video-notes/export-pdf", {
        params: { konuId, videoId: videoId || videoUrl, videoUrl },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `video-notlar-${konuId}-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF dışa aktarılamadı:", error);
      alert("PDF dışa aktarma şu anda kullanılamıyor. Backend entegrasyonu gerekli.");
    }
  };

  const formatTimestamp = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="video-notes-panel">
      <div className="video-notes-header">
        <h3>📝 Video Notları</h3>
        <div className="video-notes-actions">
          <button 
            className="video-notes-btn export-btn"
            onClick={handleExportPdf}
            title="PDF olarak dışa aktar"
          >
            📄 PDF
          </button>
          <button 
            className="video-notes-btn close-btn"
            onClick={onClose}
            title="Kapat"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="video-notes-content">
        {loading ? (
          <div className="video-notes-loading">Yükleniyor...</div>
        ) : (
          <>
            {!showAddNote ? (
              <button 
                className="video-notes-add-btn"
                onClick={() => {
                  setShowAddNote(true);
                  setNewNoteTimestamp(Math.floor(currentTime));
                  setTimeout(() => textareaRef.current?.focus(), 100);
                }}
              >
                ➕ Not Ekle ({formatTimestamp(Math.floor(currentTime))})
              </button>
            ) : (
              <div className="video-notes-add-form">
                <div className="video-notes-timestamp">
                  Zaman: {formatTimestamp(newNoteTimestamp)}
                  <button 
                    className="video-notes-time-btn"
                    onClick={() => setNewNoteTimestamp(Math.floor(currentTime))}
                  >
                    Şu anki zamanı kullan
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  className="video-notes-textarea"
                  placeholder="Notunuzu buraya yazın..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  rows={4}
                />
                <div className="video-notes-form-actions">
                  <button 
                    className="video-notes-btn save-btn"
                    onClick={handleAddNote}
                    disabled={!newNoteText.trim()}
                  >
                    Kaydet
                  </button>
                  <button 
                    className="video-notes-btn cancel-btn"
                    onClick={() => {
                      setShowAddNote(false);
                      setNewNoteText("");
                    }}
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}

            <div className="video-notes-list">
              {notes.length === 0 ? (
                <div className="video-notes-empty">
                  Henüz not eklenmemiş. İlk notunuzu eklemek için yukarıdaki butona tıklayın.
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="video-note-item">
                    <div className="video-note-header">
                      <button
                        className="video-note-timestamp"
                        onClick={() => onSeekTo && onSeekTo(note.timestampSeconds)}
                        title="Bu zamana git"
                      >
                        ⏱️ {note.timestampFormatted || formatTimestamp(note.timestampSeconds)}
                      </button>
                      <div className="video-note-actions">
                        {editingNoteId === note.id ? (
                          <>
                            <button
                              className="video-note-action-btn save-btn"
                              onClick={() => {
                                const textarea = document.querySelector(`.video-note-edit-${note.id}`);
                                if (textarea) {
                                  handleUpdateNote(note.id, textarea.value);
                                }
                              }}
                            >
                              ✓
                            </button>
                            <button
                              className="video-note-action-btn cancel-btn"
                              onClick={() => setEditingNoteId(null)}
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="video-note-action-btn edit-btn"
                              onClick={() => setEditingNoteId(note.id)}
                              title="Düzenle"
                            >
                              ✏️
                            </button>
                            <button
                              className="video-note-action-btn delete-btn"
                              onClick={() => handleDeleteNote(note.id)}
                              title="Sil"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingNoteId === note.id ? (
                      <textarea
                        className={`video-note-edit video-note-edit-${note.id}`}
                        defaultValue={note.noteText}
                        rows={3}
                      />
                    ) : (
                      <div className="video-note-text">{note.noteText}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

