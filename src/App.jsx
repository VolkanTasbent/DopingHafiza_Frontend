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
import Profilim from "./Profilim"; // ✅ yeni
import "./App.css";
import Grafiklerim from "./Grafiklerim";
import "chart.js"


export default function App() {
  const [page, setPage] = useState(
    localStorage.getItem("token") ? "dersler" : "auth"
  );
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(!!localStorage.getItem("token"));
  const [seciliDers, setSeciliDers] = useState(null);
  const [seciliDersDetay, setSeciliDersDetay] = useState(null);
  const [seciliRaporOturumId, setSeciliRaporOturumId] = useState(null);

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

  const logout = () => {
    localStorage.removeItem("token");
    setMe(null);
    setSeciliDers(null);
    setSeciliDersDetay(null);
    setSeciliRaporOturumId(null);
    setPage("auth");
  };

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

  return (
    <div>
      {/* Üst Navigasyon */}
      <nav className="nav-modern">
        <div className="nav-brand">
          <div className="brand-logo">📚</div>
          <div className="brand-text">
            <div className="brand-title">Hafıza Akademi</div>
            <div className="brand-subtitle">Öğrenme Platformu</div>
          </div>
        </div>

        <div className="nav-menu">
          <button
            className={`nav-link ${page === "dersler" ? "active" : ""}`}
            onClick={() => {
              setSeciliDers(null);
              setSeciliDersDetay(null);
              setPage("dersler");
            }}
          >
            <span>Derslerim</span>
          </button>

          <button
            className={`nav-link ${page === "coz" ? "active" : ""}`}
            onClick={() => {
              setPage("coz");
            }}
          >
            <span>Soru Çöz{seciliDers && ` - ${seciliDers.ad}`}</span>
          </button>

          <button
            className={`nav-link ${page === "deneme" ? "active" : ""}`}
            onClick={() => setPage("deneme")}
          >
            <span>Deneme Sınavları</span>
          </button>

          <button
            className={`nav-link ${page === "raporlar" ? "active" : ""}`}
            onClick={() => setPage("raporlar")}
          >
            <span>Raporlarım</span>
          </button>

          <button
            className={`nav-link ${page === "profil" ? "active" : ""}`}
            onClick={() => setPage("profil")}
          >
            <span>Profilim</span>
          </button>

          {me?.role === "ADMIN" && (
            <button
              className={`nav-link ${page === "admin" ? "active" : ""}`}
              onClick={() => setPage("admin")}
            >
              <span>Admin Panel</span>
            </button>
          )}
          <button
  className={`nav-link ${page === "grafikler" ? "active" : ""}`}
  onClick={() => setPage("grafikler")}
>
  <span>Grafiklerim</span>
</button>

        </div>

        <div className="nav-user">
          {seciliDers && (
            <div className="nav-badge">
              <span className="badge-text">{seciliDers.ad}</span>
            </div>
          )}
          <div className="user-dropdown">
            <div className="user-avatar">
              {me?.avatar_url ? (
                <img src={fileUrl(me.avatar_url) || me.avatar_url} alt="Avatar" />
              ) : (
                <span>{me?.ad?.charAt(0)?.toUpperCase() || "U"}</span>
              )}
            </div>
            <div className="user-name">
              <div className="name-text">{me?.ad} {me?.soyad}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            <span>Çıkış</span>
          </button>
        </div>
      </nav>

      {/* Sayfa İçerikleri */}
      <main className="main-content">
        {page === "dersler" && (
          <Derslerim
            onStartQuiz={(dersId, dersAd) => {
              setSeciliDers({ id: dersId, ad: dersAd });
              setPage("coz");
            }}
            onDersDetay={(ders) => {
              setSeciliDersDetay(ders);
              setPage("dersdetay");
            }}
          />
        )}

        {page === "coz" && (
          <SoruCoz
            onBack={() => setPage("dersler")}
            onFinish={() => setPage("raporlar")}
            seciliDers={seciliDers}
          />
        )}

        {page === "deneme" && (
          <DenemeSinavlari
            onBack={() => setPage("dersler")}
          />
        )}

        {page === "dersdetay" && (
          <DersDetay onBack={() => setPage("dersler")} ders={seciliDersDetay} />
        )}

        {page === "raporlar" && (
          <Raporlarim 
            onBack={() => setPage("dersler")} 
            onDetayAc={(oturumId) => {
              setSeciliRaporOturumId(oturumId);
              setPage("rapor-detay");
            }}
          />
        )}

        {page === "rapor-detay" && seciliRaporOturumId && (
          <RaporDetay 
            oturumId={seciliRaporOturumId}
            onBack={() => {
              setSeciliRaporOturumId(null);
              setPage("raporlar");
            }}
          />
        )}

        {page === "profil" && (
          <Profilim onBack={() => setPage("dersler")} />
        )}

    {
  page === "grafikler" && (
    <Grafiklerim onBack={() => setPage("raporlar")} />
  )
}



        {page === "admin" && (
          <AdminPanel onBack={() => setPage("dersler")} />
        )}

      </main>
    </div>
  );
}
