import { useEffect, useMemo, useState } from "react";
import api, { fileUrl } from "./services/api";
import "./AuthPage.css";

/** A–E hazır şıklar */
const LETTERS = ["A", "B", "C", "D", "E"];
const makeInitialOptions = () =>
  LETTERS.map((L, i) => ({ label: L, text: "", correct: i === 0, order: i + 1 }));

export default function AdminPanel({ onBack }) {
  // --- ders/konu ---
  const [dersler, setDersler] = useState([]);
  const [seciliDersId, setSeciliDersId] = useState("");
  const [yeniDers, setYeniDers] = useState("");

  const [konular, setKonular] = useState([]);
  const [seciliKonuIds, setSeciliKonuIds] = useState([]); // soru oluşturma için
  const [listeKonuId, setListeKonuId] = useState("");     // liste filtre

  const [yeniKonu, setYeniKonu] = useState("");

  // --- sorular ---
  const [sorular, setSorular] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- yeni soru formu ---
  const [form, setForm] = useState({
    metin: "",
    tip: "coktan_secmeli",
    zorluk: 1,
    soruNo: "",
    aciklama: "",
    imageUrl: "",
  });
  const [options, setOptions] = useState(makeInitialOptions());

  // --- ui ---
  const [msg, setMsg] = useState("");

  const errText = (e) =>
    e?.response?.data?.message || e?.response?.data || e?.message || "Hata";

  // --------- EFFECTS ----------
  useEffect(() => { fetchDersler(); }, []);

  useEffect(() => {
    if (seciliDersId) {
      fetchKonular(seciliDersId);
      fetchSorular(); // default liste
      setSeciliKonuIds([]);
    } else {
      setKonular([]); setSorular([]); setSeciliKonuIds([]);
    }
  }, [seciliDersId]);

  // --------- API CALLS ----------
  async function fetchDersler() {
    try {
      const { data } = await api.get("/api/ders");
      setDersler(data || []);
    } catch (e) { setMsg("Dersler alınamadı: " + errText(e)); }
  }

  async function addDers(e) {
    e.preventDefault();
    if (!yeniDers.trim()) return;
    try {
      await api.post("/api/ders", { ad: yeniDers.trim() });
      setYeniDers("");
      fetchDersler();
    } catch (e) { setMsg("Ders eklenemedi: " + errText(e)); }
  }

  async function fetchKonular(dersId) {
    try {
      const { data } = await api.get("/api/konu", { params: { dersId } });
      setKonular(data || []);
    } catch (e) { setMsg("Konular alınamadı: " + errText(e)); }
  }

  async function addKonu(e) {
    e.preventDefault();
    if (!seciliDersId) return setMsg("Önce ders seçin.");
    if (!yeniKonu.trim()) return;
    try {
      await api.post("/api/konu", { dersId: Number(seciliDersId), ad: yeniKonu.trim() });
      setYeniKonu("");
      fetchKonular(seciliDersId);
    } catch (e) { setMsg("Konu eklenemedi: " + errText(e)); }
  }

  async function fetchSorular() {
    if (!seciliDersId) return;
    setLoading(true);
    try {
      const params = { dersId: Number(seciliDersId), limit: 100 };
      if (listeKonuId) params.konuId = Number(listeKonuId);
      const { data } = await api.get("/api/sorular", { params });
      setSorular(data || []);
      setMsg("");
    } catch (e) { setMsg("Sorular alınamadı: " + errText(e)); }
    finally { setLoading(false); }
  }

  async function deleteSoru(id) {
    if (!confirm("Soru silinsin mi?")) return;
    try { await api.delete(`/api/sorular/${id}`); await fetchSorular(); }
    catch (e) { setMsg("Soru silinemedi: " + errText(e)); }
  }

  async function deleteSecenek(id) {
    if (!confirm("Seçenek silinsin mi?")) return;
    try { await api.delete(`/api/sorular/secenekler/${id}`); await fetchSorular(); }
    catch (e) { setMsg("Seçenek silinemedi: " + errText(e)); }
  }

  // --------- UPLOAD ----------
  async function uploadImage(file) {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/api/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // { url: "/files/xxx.jpg" }
      setForm((s) => ({ ...s, imageUrl: data.url }));
    } catch (e) { setMsg("Resim yüklenemedi: " + errText(e)); }
  }

  // --------- QUESTION CREATE (with options) ----------
  const validOptionCount = useMemo(
    () => options.filter((o) => o.text.trim() !== "").length,
    [options]
  );
  const correctIndex = useMemo(
    () => options.findIndex((o) => o.correct),
    [options]
  );

  function setOptionText(idx, text) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text } : o)));
  }
  function setOptionCorrect(idx) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, correct: i === idx })));
  }
  function resetForm() {
    setForm({ metin: "", tip: "coktan_secmeli", zorluk: 1, soruNo: "", aciklama: "", imageUrl: "" });
    setOptions(makeInitialOptions());
    setSeciliKonuIds([]);
  }

  async function createQuestion(e) {
    e.preventDefault();
    if (!seciliDersId) return setMsg("Önce ders seçin.");
    if (!form.metin.trim()) return setMsg("Soru metni boş olamaz.");
    if (seciliKonuIds.length === 0) return setMsg("En az bir konu seçmelisiniz.");
    if (validOptionCount < 2) return setMsg("En az iki şık doldurun.");
    if (correctIndex === -1) return setMsg("Bir doğru şık işaretleyin.");

    setSaving(true);
    try {
      // 1) Soru oluştur
      const { data: soru } = await api.post("/api/sorular", {
        dersId: Number(seciliDersId),
        konuIds: seciliKonuIds,
        metin: form.metin.trim(),
        tip: form.tip || "coktan_secmeli",
        zorluk: Number(form.zorluk) || 1,
        imageUrl: form.imageUrl || null,
        aciklama: form.aciklama || null,
        soruNo: form.soruNo ? Number(form.soruNo) : null,
      });

      // 2) A–E şıklarını ekle (boş olanları atla)
      const filled = options.filter((o) => o.text.trim() !== "");
      await Promise.all(
        filled.map((o) =>
          api.post(`/api/sorular/${soru.id}/secenekler`, {
            metin: o.text.trim(),
            dogru: o.correct,
            siralama: o.order,
          })
        )
      );

      resetForm();
      await fetchSorular();
      setMsg("Soru ve şıklar eklendi.");
    } catch (e) {
      setMsg("Soru eklenemedi: " + errText(e));
    } finally {
      setSaving(false);
    }
  }

  // --------- RENDER ----------
  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <h2 className="auth-title">Admin Panel</h2>
          <div className="tab-buttons">
            <button type="button" onClick={() => (onBack ? onBack() : window.history.back())}>← Geri</button>
          </div>
        </div>

        <div className="auth-form">
          {msg && <p style={{ color: "crimson" }}>{msg}</p>}

          {/* DERS EKLE / SEÇ */}
          <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Ders Seçimi</div>
                <select value={seciliDersId} onChange={(e) => setSeciliDersId(e.target.value)}>
                  <option value="">— Ders seçin —</option>
                  {dersler.map((d) => (
                    <option key={d.id} value={d.id}>{d.ad}</option>
                  ))}
                </select>
              </div>

              <form onSubmit={addDers} style={{ alignSelf: "end", display: "flex", gap: 8 }}>
                <input placeholder="Yeni ders adı" value={yeniDers} onChange={(e) => setYeniDers(e.target.value)} />
                <button type="submit">Ders Ekle</button>
              </form>
            </div>
          </section>

          {/* KONU YÖNETİMİ */}
          {seciliDersId && (
            <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Konular (Soru için çoklu seç)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {konular.map((k) => (
                      <label key={k.id} style={{ border: "1px solid #e5e7eb", borderRadius: 999, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={seciliKonuIds.includes(k.id)}
                          onChange={() =>
                            setSeciliKonuIds((prev) =>
                              prev.includes(k.id) ? prev.filter((x) => x !== k.id) : [...prev, k.id]
                            )
                          }
                        />
                        {k.ad}
                      </label>
                    ))}
                  </div>
                </div>

                <form onSubmit={addKonu} style={{ alignSelf: "end", display: "flex", gap: 8 }}>
                  <input placeholder="Yeni konu adı" value={yeniKonu} onChange={(e) => setYeniKonu(e.target.value)} />
                  <button type="submit">Konu Ekle</button>
                </form>
              </div>
            </section>
          )}

          {/* SORU OLUŞTUR */}
          {seciliDersId && (
            <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Soru Oluştur</h3>
              <form onSubmit={createQuestion}>
                <textarea
                  rows={3}
                  placeholder="Soru metni"
                  value={form.metin}
                  onChange={(e) => setForm((s) => ({ ...s, metin: e.target.value }))}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                  <input placeholder="Tip (coktan_secmeli)" value={form.tip} onChange={(e) => setForm((s) => ({ ...s, tip: e.target.value }))} />
                  <input type="number" min="1" max="5" placeholder="Zorluk (1–5)" value={form.zorluk} onChange={(e) => setForm((s) => ({ ...s, zorluk: e.target.value }))} />
                  <input type="number" placeholder="Soru No (opsiyonel)" value={form.soruNo} onChange={(e) => setForm((s) => ({ ...s, soruNo: e.target.value }))} />
                </div>

                <input style={{ marginTop: 8 }} placeholder="Açıklama (opsiyonel)" value={form.aciklama} onChange={(e) => setForm((s) => ({ ...s, aciklama: e.target.value }))} />

                {/* Görsel: URL veya dosya */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <input placeholder="Görsel URL (ops.)" value={form.imageUrl} onChange={(e) => setForm((s) => ({ ...s, imageUrl: e.target.value }))} />
                  <input type="file" accept="image/*" onChange={(e) => uploadImage(e.target.files?.[0])} />
                </div>
                {form.imageUrl && (
                  <img src={fileUrl(form.imageUrl)} alt="preview" style={{ maxWidth: 260, marginTop: 8, borderRadius: 8 }} />
                )}

                {/* ŞIKLAR A–E */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Şıklar (A–E)</div>
                  {options.map((o, idx) => (
                    <label key={o.label} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ width: 22, textAlign: "center", fontWeight: 700 }}>{o.label})</span>
                      <input
                        placeholder={`${o.label} şıkkı metni`}
                        value={o.text}
                        onChange={(e) => setOptionText(idx, e.target.value)}
                      />
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="radio"
                          name="correct"
                          checked={o.correct}
                          onChange={() => setOptionCorrect(idx)}
                          title="Doğru şık"
                        />
                        Doğru
                      </span>
                    </label>
                  ))}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    * En az iki şık doldurun. Birini “Doğru” seçin. Sıralama A=1 … E=5 olarak gönderilir.
                  </div>
                </div>

                <button type="submit" disabled={saving} style={{ marginTop: 12 }}>
                  {saving ? "Kaydediliyor..." : "Soru + Şıklar Ekle"}
                </button>
              </form>
            </section>
          )}

          {/* SORU LİSTESİ */}
          {seciliDersId && (
            <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                <select value={listeKonuId} onChange={(e) => setListeKonuId(e.target.value)}>
                  <option value="">Tüm konular</option>
                  {konular.map((k) => (
                    <option key={k.id} value={k.id}>{k.ad}</option>
                  ))}
                </select>
                <button type="button" onClick={fetchSorular} disabled={loading}>
                  {loading ? "Yükleniyor..." : "Listeyi Yenile"}
                </button>
              </div>

              {sorular.length === 0 && <p>Seçilen ölçütlerde soru yok.</p>}

              {sorular.map((q) => (
                <div key={q.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{q.metin}</div>
                    <button type="button" onClick={() => deleteSoru(q.id)} style={{ background: "#c0392b", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 6 }}>
                      Soru Sil
                    </button>
                  </div>

                  {/* konu rozetleri */}
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(q.konular || []).map((k) => (
                      <span key={k.id} style={{ fontSize: 12, background: "#eef2ff", color: "#3730a3", padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb" }}>
                        {k.ad}
                      </span>
                    ))}
                  </div>

                  {q.imageUrl && <img src={fileUrl(q.imageUrl)} alt="soru" style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }} />}

                  {/* mevcut şıklar */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Şıklar</div>
                    {(q.secenekler || []).map((opt) => (
                      <div key={opt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eee", borderRadius: 8, padding: "6px 10px", marginBottom: 6, background: opt.dogru ? "#ecfdf5" : "#fff" }}>
                        <div>{opt.siralama ? `${opt.siralama}) ` : ""}{opt.metin} {opt.dogru ? "✅" : ""}</div>
                        <button type="button" onClick={() => deleteSecenek(opt.id)} style={{ background: "#e74c3c", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 6 }}>
                          Sil
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
