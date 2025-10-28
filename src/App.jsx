// src/App.jsx
import { useEffect, useState } from "react";
import api from "./services/api";
import AuthPage from "./AuthPage";
import Derslerim from "./Derslerim";
import SoruCoz from "./SoruCoz";
import Raporlarim from "./Raporlarim";
import RaporDetay from "./RaporDetay";
import AdminPanel from "./AdminPanel";
import DersDetay from "./DersDetay";
import Profilim from "./Profilim"; // ✅ yeni
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
      <nav className="nav">
        <div className="brand">🧠 Hafıza / Quiz</div>

        <div className="nav-buttons">
          <button
            className={`btn-ghost ${page === "dersler" ? "active" : ""}`}
            onClick={() => {
              setSeciliDers(null);
              setSeciliDersDetay(null);
              setPage("dersler");
            }}
          >
            Derslerim
          </button>

          <button
            className={`btn-ghost ${page === "coz" ? "active" : ""}`}
            onClick={() => {
              if (!seciliDers) {
                alert("Lütfen önce bir ders seçin!");
                return;
              }
              setPage("coz");
            }}
            disabled={!seciliDers}
          >
            Soru Çöz {seciliDers && `- ${seciliDers.ad}`}
          </button>

          <button
            className={`btn-ghost ${page === "raporlar" ? "active" : ""}`}
            onClick={() => setPage("raporlar")}
          >
            Raporlarım
          </button>

          <button
            className={`btn-ghost ${page === "profil" ? "active" : ""}`}
            onClick={() => setPage("profil")}
          >
            Profilim
          </button>

          {me?.role === "ADMIN" && (
            <button
              className={`btn-ghost ${page === "admin" ? "active" : ""}`}
              onClick={() => setPage("admin")}
            >
              Admin Panel
            </button>
          )}
        </div>

        <div className="spacer" />
        <div className="user-info">
          {seciliDers && (
            <span
              className="pill"
              style={{ background: "#e3f2fd", color: "#1976d2" }}
            >
              📚 {seciliDers.ad}
            </span>
          )}
          <span className="pill">
            {me?.ad} {me?.soyad}
          </span>
          <button className="btn-danger" onClick={logout}>
            Çıkış
          </button>
        </div>
      </nav>

      {/* Sayfa İçerikleri */}
      <main className="auth-container" style={{ paddingTop: 24 }}>
        <div className="auth-box">
          {page === "dersler" && (
            <Section title="📘 Derslerim">
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
            </Section>
          )}

          {page === "coz" && (
            <Section
              title={`📝 Soru Çöz - ${seciliDers?.ad || "Ders Seçilmedi"}`}
              onBack={() => setPage("dersler")}
            >
              <SoruCoz
                onBack={() => setPage("dersler")}
                onFinish={() => setPage("raporlar")}
                seciliDers={seciliDers}
              />
            </Section>
          )}

          {page === "dersdetay" && (
            <Section title="📘 Ders Detayı" onBack={() => setPage("dersler")}>
              <DersDetay onBack={() => setPage("dersler")} ders={seciliDersDetay} />
            </Section>
          )}

          {page === "raporlar" && (
            <Section title="📊 Raporlarım" onBack={() => setPage("dersler")}>
              <Raporlarim 
                onBack={() => setPage("dersler")} 
                onDetayAc={(oturumId) => {
                  setSeciliRaporOturumId(oturumId);
                  setPage("rapor-detay");
                }}
              />
            </Section>
          )}

          {page === "rapor-detay" && seciliRaporOturumId && (
            <Section title="🧠 Rapor Detayı" onBack={() => setPage("raporlar")}>
              <RaporDetay 
                oturumId={seciliRaporOturumId}
                onBack={() => {
                  setSeciliRaporOturumId(null);
                  setPage("raporlar");
                }}
              />
            </Section>
          )}

          {page === "profil" && (
            <Section title="👤 Profilim" onBack={() => setPage("dersler")}>
              <Profilim onBack={() => setPage("dersler")} />
            </Section>
          )}

          {page === "admin" && (
            <Section title="🧩 Admin Panel" onBack={() => setPage("dersler")}>
              <AdminPanel onBack={() => setPage("dersler")} />
            </Section>
          )}
        </div>
      </main>
    </div>
  );
}

function Section({ title, onBack, children }) {
  return (
    <>
      <div className="auth-header">
        <h2 className="auth-title">{title}</h2>
        {onBack && (
          <div className="row">
            <button className="btn-ghost" onClick={onBack}>
              ← Geri
            </button>
          </div>
        )}
      </div>
      <div className="auth-form">{children}</div>
    </>
  );
}
