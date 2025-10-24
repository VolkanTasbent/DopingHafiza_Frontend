import { useEffect, useState } from "react";
import { kullaniciEkle, kullaniciGuncelle } from "../services/kullaniciServisi";

const boş = { email:"", ad:"", soyad:"", sifre:"" };

export default function KullaniciFormu({ secili, onKaydet }) {
  const [form, setForm] = useState(boş);
  const [hata, setHata] = useState(null);
  const düzenleModu = !!(secili && secili.id);

  useEffect(() => {
    setForm(secili ? { ...secili } : boş);
  }, [secili]);

  const değiştir = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const gönder = async (e) => {
    e.preventDefault();
    setHata(null);
    try {
      if (düzenleModu) {
        await kullaniciGuncelle(secili.id, form);
      } else {
        await kullaniciEkle(form);
      }
      onKaydet?.(); // parent'e haber ver
      setForm(boş);
    } catch (err) {
      setHata(err?.response?.data || err.message);
    }
  };

  return (
    <form onSubmit={gönder} style={{ display:"grid", gap:8, padding:12, border:"1px solid #eee", borderRadius:8 }}>
      <h2>{düzenleModu ? "Kullanıcı Güncelle" : "Yeni Kullanıcı"}</h2>
      {hata && <div style={{ color:"crimson" }}>{String(hata)}</div>}
      <input placeholder="E-posta" value={form.email} onChange={e => değiştir("email", e.target.value)} required />
      <input placeholder="Ad"     value={form.ad}    onChange={e => değiştir("ad", e.target.value)} required />
      <input placeholder="Soyad"  value={form.soyad} onChange={e => değiştir("soyad", e.target.value)} required />
      <input placeholder="Şifre"  value={form.sifre} onChange={e => değiştir("sifre", e.target.value)} required />
      <button type="submit">{düzenleModu ? "Kaydet" : "Ekle"}</button>
    </form>
  );
}
