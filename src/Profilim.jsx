// src/Profilim.jsx
import React, { useEffect, useState } from "react";
import api from "./services/api";
import "./Profilim.css";

export default function Profilim({ onBack }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/api/users/me");
        setUser(data);
      } catch (e) {
        setMsg("Profil alınamadı: " + (e.response?.data || e.message));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Yükleniyor...</p>;
  if (msg) return <p style={{ color: "crimson" }}>{msg}</p>;
  if (!user) return <p>Kullanıcı bilgisi bulunamadı.</p>;

  return (
    <div className="profil-container">
      <div className="profil-card">
        <h2>👤 Profil Bilgilerim</h2>

        <div className="profil-info">
          <div><b>Ad:</b> {user.ad}</div>
          <div><b>Soyad:</b> {user.soyad}</div>
          <div><b>Email:</b> {user.email}</div>
          <div><b>Rol:</b> {user.role}</div>
        </div>

        <button className="profil-back-btn" onClick={onBack}>
          ← Geri Dön
        </button>
      </div>
    </div>
  );
}
