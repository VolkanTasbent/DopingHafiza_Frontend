import { useEffect, useState } from "react";
import { kullanicilariGetir, kullaniciSil } from "../services/kullaniciServisi";

export default function KullaniciListesi({ sec, yenileIstegi }) {
  const [liste, setListe] = useState([]);
  const [yükleniyor, setYükleniyor] = useState(false);
  const [hata, setHata] = useState(null);

  const yükle = async () => {
    try {
      setYükleniyor(true);
      const data = await kullanicilariGetir();
      setListe(data || []);
    } catch (e) {
      setHata(e?.response?.data || e.message);
    } finally {
      setYükleniyor(false);
    }
  };

  useEffect(() => { yükle(); }, []);
  useEffect(() => { if (yenileIstegi) yükle(); }, [yenileIstegi]);

  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
      <h2>Kullanıcılar</h2>
      {yükleniyor && <div>Yükleniyor...</div>}
      {hata && <div style={{ color: "crimson" }}>{String(hata)}</div>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {liste.map(k => (
          <li key={k.id} style={{ display:"flex", gap:12, alignItems:"center", padding:"6px 0", borderBottom:"1px solid #f2f2f2" }}>
            <div style={{ flex:1 }}>
              <b>{k.ad} {k.soyad}</b> — {k.email}
            </div>
            <button onClick={() => sec(k)}>Düzenle</button>
            <button
              onClick={async () => { await kullaniciSil(k.id); await yükle(); }}
              style={{ color:"white", background:"#c0392b", border:"none", padding:"6px 10px", borderRadius:6 }}
            >
              Sil
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
