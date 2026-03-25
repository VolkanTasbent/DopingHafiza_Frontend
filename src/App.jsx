// src/App.jsx
import { useEffect, useState } from "react";
import api, { fileUrl } from "./services/api";

import AuthPage from "./AuthPage";
import Derslerim from "./Derslerim";
import SoruCoz from "./SoruCoz";
import DenemeSinavlari from "./DenemeSinavlari";
import Raporlarim from "./Raporlarim";
import RaporDetay from "./RaporDetay";
import AdminPanel from "./AdminPanel";
import DersDetay from "./DersDetay";
import Profilim from "./Profilim";
import Grafiklerim from "./Grafiklerim";
import Gamification from "./Gamification";
import DailyTasks from "./DailyTasks";
import BadgeCollection from "./BadgeCollection";
import FlashCard from "./FlashCard";
import Dashboard from "./Dashboard";
import Takvim from "./Takvim";
import SearchModal from "./SearchModal";
import PomodoroTimer from "./PomodoroTimer";
import NotificationCenter from "./NotificationCenter";
import AIAssistant from "./AIAssistant";
import CalismaProgrami from "./CalismaProgrami";


import "./App.css";

export default function App() {
  const [page, setPage] = useState(
    localStorage.getItem("token") ? "dersler" : "auth"
  );
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(!!localStorage.getItem("token"));

  const [seciliDers, setSeciliDers] = useState(null);
  const [seciliDersDetay, setSeciliDersDetay] = useState(null);
  const [seciliRaporOturumId, setSeciliRaporOturumId] = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Dark mode'u kullanıcıya özel yükle
  useEffect(() => {
    const loadUserDarkMode = async () => {
      if (!me?.id) {
        // Kullanıcı yoksa varsayılan değeri kullan
        setDarkMode(false);
        return;
      }
      
      try {
        // Backend'den kullanıcı ayarlarını yükle
        const { data } = await api.get("/api/users/me");
        if (data.darkMode !== undefined) {
          setDarkMode(data.darkMode);
        } else {
          // Backend'de yoksa localStorage'dan yükle (kullanıcıya özel)
          const saved = localStorage.getItem(`darkMode_${me.id}`);
          if (saved !== null) {
            setDarkMode(JSON.parse(saved));
          }
        }
      } catch (error) {
        console.error("Dark mode yüklenemedi:", error);
        // Fallback: localStorage'dan yükle (kullanıcıya özel)
        const saved = localStorage.getItem(`darkMode_${me.id}`);
        if (saved !== null) {
          setDarkMode(JSON.parse(saved));
        }
      }
    };
    
    loadUserDarkMode();
  }, [me?.id]);

  // Dark mode toggle
  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    
    if (me?.id) {
      try {
        // Backend'e kaydet
        await api.put("/api/users/me", { darkMode: newMode });
      } catch (error) {
        console.error("Dark mode backend'e kaydedilemedi:", error);
        // Fallback: localStorage'a kaydet (kullanıcıya özel)
        localStorage.setItem(`darkMode_${me.id}`, JSON.stringify(newMode));
      }
    } else {
      // Kullanıcı yoksa genel localStorage'a kaydet
      localStorage.setItem("darkMode", JSON.stringify(newMode));
    }
  };

  // Dark mode class'ını body'ye ekle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // -----------------------------------
  // ME BİLGİ ÇEKME
  // -----------------------------------
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setMe(null);
      setLoadingMe(false);
      if (page !== "auth") setPage("auth");
      return;
    }

    let alive = true;
    setLoadingMe(true);

    api
      .get("/api/users/me")
      .then((r) => {
        if (alive) {
          setMe(r.data);
          setLoadingMe(false);
        }
      })
      .catch(() => {
        if (alive) {
          localStorage.removeItem("token");
          setMe(null);
          setLoadingMe(false);
          setPage("auth");
        }
      });

    return () => {
      alive = false;
    };
  }, [page]);

  // -----------------------------------
  // LOGOUT
  // -----------------------------------
  const logout = () => {
    localStorage.removeItem("token");
    setMe(null);
    setSeciliDers(null);
    setSeciliDersDetay(null);
    setSeciliRaporOturumId(null);
    setPage("auth");
  };

  // -----------------------------------
  // LOADING SCREEN
  // -----------------------------------
  if (loadingMe) {
    return (
      <div className="auth-container center">
        <div className="auth-box center" style={{ minHeight: 180 }}>
          <div className="spinner"></div>
          <p style={{ marginTop: 12 }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // -----------------------------------
  // AUTH SAYFASI
  // -----------------------------------
  if (page === "auth") {
    return (
      <AuthPage
        onSuccess={(user) => {
          setMe(user);
          setPage("dersler");
        }}
      />
    );
  }

  // -----------------------------------
  // ANA UYGULAMA (LAYOUT DEĞİŞTİRİLMİŞ)
  // -----------------------------------
  return (
    <div className="app-container">
      
      {/* ====== SOL SİDEBAR ====== */}
      <aside className="sidebar">
        <div 
          className="logo-box"
          onClick={() => setPage("dersler")}
          style={{ cursor: "pointer" }}
        >
          <span className="logo-icon">📚</span>
          <span className="logo-text">Hafıza Akademi</span>
        </div>

        <div className="menu">
          <button
            className={`menu-item ${page === "dersler" ? "active" : ""}`}
            onClick={() => setPage("dersler")}
          >
            📘 Derslerim
          </button>

          <button
            className={`menu-item ${page === "coz" ? "active" : ""}`}
            onClick={() => setPage("coz")}
          >
            📝 Soru Çöz
          </button>

          <button
            className={`menu-item ${page === "deneme" ? "active" : ""}`}
            onClick={() => setPage("deneme")}
          >
            📊 Deneme Sınavları
          </button>

          <button
            className={`menu-item ${page === "raporlar" ? "active" : ""}`}
            onClick={() => setPage("raporlar")}
          >
            📈 Raporlarım
          </button>

          <button
            className={`menu-item ${page === "grafikler" ? "active" : ""}`}
            onClick={() => setPage("grafikler")}
          >
            📉 Grafiklerim
          </button>

          <button
            className={`menu-item ${page === "tasks" ? "active" : ""}`}
            onClick={() => setPage("tasks")}
          >
            🎯 Görevler
          </button>

          <button
            className={`menu-item ${page === "badges" ? "active" : ""}`}
            onClick={() => setPage("badges")}
          >
            🏅 Rozet Koleksiyonu
          </button>

          <button
            className={`menu-item ${page === "takvim" ? "active" : ""}`}
            onClick={() => setPage("takvim")}
          >
            📅 Takvim
          </button>

          <button
            className={`menu-item ${page === "calisma-programi" ? "active" : ""}`}
            onClick={() => setPage("calisma-programi")}
          >
            📋 Çalışma programı
          </button>

          <button
            className={`menu-item ${page === "ai" ? "active" : ""}`}
            onClick={() => setPage("ai")}
          >
            🤖 AI Kocum
          </button>

          <button
            className={`menu-item ${page === "pomodoro" ? "active" : ""}`}
            onClick={() => setPage("pomodoro")}
          >
            🍅 Pomodoro
          </button>

          {me?.role === "ADMIN" && (
            <button
              className={`menu-item ${page === "admin" ? "active" : ""}`}
              onClick={() => setPage("admin")}
            >
              🛠 Admin Panel
            </button>
          )}
        </div>
      </aside>

      {/* ====== ANA BÖLÜM ====== */}
      <div className="main-area">

        {/* ====== ÜST BAR ====== */}
        <header className="topbar">
          <div className="search">
            <input
              type="text"
              placeholder="Ders, ünite veya konu ara..."
              onClick={() => setSearchModalOpen(true)}
              readOnly
            />
          </div>

          <div className="topbar-right">
            <button 
              className="dark-mode-toggle"
              onClick={toggleDarkMode}
              title={darkMode ? "Açık Moda Geç" : "Koyu Moda Geç"}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <NotificationCenter 
              notifications={[
                {
                  id: 1,
                  icon: '🎯',
                  title: 'Günlük Hedef Tamamlandı!',
                  message: 'Bugün 30 soru çözdün. Harika iş!',
                  time: '2 saat önce',
                  read: false,
                  onClick: () => setPage("tasks")
                },
                {
                  id: 2,
                  icon: '🏆',
                  title: 'Yeni Rozet Kazandın!',
                  message: 'Başlangıç Ustası rozetini kazandın.',
                  time: '5 saat önce',
                  read: false,
                  onClick: () => setPage("badges")
                }
              ]}
            />
            <div 
              className="user-info" 
              onClick={() => setPage("profil")}
              style={{ cursor: "pointer" }}
            >
              <div className="avatar">
                {me?.avatar_url ? (
                  <img src={fileUrl(me.avatar_url)} alt="avatar" />
                ) : (
                  me?.ad?.charAt(0)
                )}
              </div>
              <span>{me?.ad} {me?.soyad}</span>
            </div>

            <button className="logout-btn" onClick={logout}>
              Çıkış
            </button>
          </div>
        </header>

        {/* ====== SAYFA İÇERİK ====== */}
        <main className="content">

{page === "dersler" && (
  <>
    <Dashboard 
      key={`dashboard-${page}`}
      me={me} 
      onNavigate={setPage}
      onSelectDers={(ders) => {
        setSeciliDers(ders);
        setPage("coz");
      }}
      onSelectDersDetay={(ders) => {
        setSeciliDersDetay(ders);
        setPage("dersdetay");
      }}
    />
    <Derslerim
      onStartQuiz={(dersId, dersAd) => {
        setSeciliDers({ id: dersId, ad: dersAd });
        setPage("coz");
      }}
      onDersDetay={(ders) => {
        setSeciliDersDetay(ders);
        setPage("dersdetay");
      }}
      onStartFlashCard={(ders) => {
        setSeciliDers(ders);
        setPage("flash");
      }}
    />
  </>
)}


          {page === "coz" && (
            <SoruCoz
              onBack={() => setPage("dersler")}
              onFinish={() => setPage("raporlar")}
              seciliDers={seciliDers}
              me={me}
            />
          )}

          {page === "deneme" && (
            <DenemeSinavlari onBack={() => setPage("dersler")} />
          )}

          {page === "raporlar" && (
            <Raporlarim
              onBack={() => setPage("dersler")}
              onDetayAc={(id) => {
                setSeciliRaporOturumId(id);
                setPage("rapor-detay");
              }}
            />
          )}

          {page === "rapor-detay" && (
            <RaporDetay
              oturumId={seciliRaporOturumId}
              onBack={() => setPage("raporlar")}
            />
          )}

          {page === "dersdetay" && (
            <DersDetay
              onBack={() => setPage("dersler")}
              ders={seciliDersDetay}
              initialTab={seciliDersDetay?._initialTab}
              scrollToKonuId={seciliDersDetay?._scrollToKonuId}
              me={me}
            />
          )}

          {page === "profil" && <Profilim onBack={() => setPage("dersler")} />}

          {page === "grafikler" && (
            <Grafiklerim onBack={() => setPage("raporlar")} />
          )}

          {page === "admin" && <AdminPanel onBack={() => setPage("dersler")} />}

          {page === "game" && <Gamification onBack={() => setPage("dersler")} />}

          {page === "tasks" && (
            <DailyTasks onBack={() => setPage("game")} />
          )}

          {page === "badges" && (
            <BadgeCollection onBack={() => setPage("dersler")} />
          )}

          {page === "flash" && (
            <FlashCard
              onBack={() => setPage("dersler")}
              seciliDers={seciliDers}
              me={me}
            />
          )}

          {page === "takvim" && (
            <Takvim onBack={() => setPage("dersler")} me={me} />
          )}

      {page === "pomodoro" && (
  <PomodoroTimer me={me} />
)}

          {page === "ai" && (
            <AIAssistant onBack={() => setPage("dersler")} />
          )}

          {page === "calisma-programi" && (
            <CalismaProgrami onBack={() => setPage("dersler")} />
          )}

        </main>
      </div>

      {/* Arama Modal */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onNavigate={(pageName) => {
          setPage(pageName);
          setSearchModalOpen(false);
        }}
        onSelectDers={(ders) => {
          setSeciliDers(ders);
        }}
        onSelectDersDetay={(ders) => {
          setSeciliDersDetay(ders);
        }}
      />
    </div>
  );
}
