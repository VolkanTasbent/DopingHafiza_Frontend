import { useEffect, useMemo, useRef, useState } from "react";
import api, { fileUrl } from "./services/api";
import { submitQuiz } from "./services/quiz";
import "./AuthPage.css";

export default function SoruCoz({ onBack }) {
  // seçimler
  const [dersler, setDersler] = useState([]);
  const [seciliDersId, setSeciliDersId] = useState("");
  const [konular, setKonular] = useState([]);
  const [seciliKonuId, setSeciliKonuId] = useState("");

  // test durumu
  const [sorular, setSorular] = useState([]);
  const [step, setStep] = useState("select"); // select -> ready -> running -> result
  const [current, setCurrent] = useState(0);
  const [secimler, setSecimler] = useState({});  // { [soruId]: secenekId }

  // zaman
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);

  const [msg, setMsg] = useState("");

  // --- helpers ---
  const errText = (e) =>
    e?.response?.data?.message || e?.response?.data?.error || e?.response?.data || e?.message || "Hata";

  const sureStr = useMemo(() => {
    const s = Math.floor(elapsedMs / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [elapsedMs]);

  // --- effects ---
  useEffect(() => { fetchDersler(); }, []);
  useEffect(() => {
    if (seciliDersId) {
      fetchKonular(seciliDersId);
      setSeciliKonuId("");
      setSorular([]);
      setStep("select");
    } else {
      setKonular([]); setSorular([]); setStep("select");
    }
  }, [seciliDersId]);

  useEffect(() => () => { stopTimer(); }, []);

  // --- api calls ---
  async function fetchDersler() {
    try {
      const { data } = await api.get("/api/ders");
      setDersler(data || []);
    } catch (e) {
      setMsg("Dersler alınamadı: " + errText(e));
    }
  }

  async function fetchKonular(dersId) {
    try {
      const { data } = await api.get("/api/konu", { params: { dersId } });
      setKonular(data || []);
    } catch (e) {
      setMsg("Konular alınamadı: " + errText(e));
    }
  }

  async function getirSorular() {
    if (!seciliDersId) return setMsg("Önce ders seçin.");
    try {
      const params = { dersId: Number(seciliDersId), limit: 100 };
      if (seciliKonuId) params.konuId = Number(seciliKonuId);
      const { data } = await api.get("/api/sorular", { params });
      setSorular(data || []);
      setSecimler({});
      setCurrent(0);
      if (!data?.length) {
        setMsg("Bu filtrede soru bulunamadı.");
        setStep("select");
      } else {
        setMsg("");
        setStep("ready"); // Teste Başla butonunu göster
      }
    } catch (e) {
      setMsg("Sorular alınamadı: " + errText(e));
    }
  }

  // --- test akışı ---
  function startTimer() {
    startedAtRef.current = new Date();
    setElapsedMs(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current.getTime());
    }, 250);
  }
  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function startTest() {
    setStep("running");
    startTimer();
  }

  function choose(soruId, secenekId) {
    setSecimler((prev) => ({ ...prev, [soruId]: secenekId }));
  }

  async function submitTest() {
    try {
      stopTimer();
      const finishedAt = new Date();
      const items = sorular.map((q) => ({
        soruId: q.id,
        secenekId: secimler[q.id] ?? null,
      }));
      const payload = {
        items,
        startedAt: startedAtRef.current?.toISOString() ?? new Date().toISOString(),
        finishedAt: finishedAt.toISOString(),
      };
      const res = await submitQuiz(payload);
      // res: { oturumId, correct, wrong, total, score }
      setMsg("");
      setStep("result");
      // sonucu state'e koy
      setResult(res);
    } catch (e) {
      setMsg("Gönderim başarısız: " + errText(e));
      // süre görünmeye devam etmesin
      setStep("ready");
    }
  }

  const [result, setResult] = useState(null);

  // --- render ---
  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <h2 className="auth-title">Soru Çöz</h2>
          <div className="tab-buttons">
            <button type="button" onClick={() => (onBack ? onBack() : window.history.back())}>← Geri</button>
          </div>
        </div>

        <div className="auth-form">
          {msg && <p style={{ color: "crimson" }}>{msg}</p>}

          {/* seçim barı */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 16 }}>
            <select value={seciliDersId} onChange={(e) => setSeciliDersId(e.target.value)}>
              <option value="">Ders Seçin</option>
              {dersler.map((d) => (
                <option key={d.id} value={d.id}>{d.ad}</option>
              ))}
            </select>

            <select value={seciliKonuId} onChange={(e) => setSeciliKonuId(e.target.value)} disabled={!seciliDersId}>
              <option value="">(İsteğe bağlı) Konu Seçin</option>
              {konular.map((k) => (
                <option key={k.id} value={k.id}>{k.ad}</option>
              ))}
            </select>

            <button type="button" onClick={getirSorular}>Soruları Getir</button>
          </div>

          {/* henüz başlamadan */}
          {step === "ready" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>Toplam soru: <b>{sorular.length}</b></div>
              <button type="button" onClick={startTest}>Teste Başla</button>
            </div>
          )}

          {/* test sırasında */}
          {step === "running" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>Toplam: <b>{sorular.length}</b> • Soru: <b>{current + 1}</b> / {sorular.length}</div>
                <div style={{ fontWeight: 700 }}>{sureStr}</div>
              </div>

              {sorular.length > 0 && (
                <SoruCard
                  soru={sorular[current]}
                  seciliId={secimler[sorular[current].id] ?? null}
                  onChoose={choose}
                />
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" onClick={() => setCurrent((i) => Math.max(0, i - 1))} disabled={current === 0}>
                  ◀ Önceki
                </button>
                <button
                  type="button"
                  onClick={() => setCurrent((i) => Math.min(sorular.length - 1, i + 1))}
                  disabled={current === sorular.length - 1}
                >
                  Sonraki ▶
                </button>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={submitTest}>
                  Testi Bitir &amp; Gönder
                </button>
              </div>
            </>
          )}

          {/* sonuç ekranı */}
          {step === "result" && result && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Özet</h3>
              <p>Doğru: <b>{result.correct}</b> • Yanlış: <b>{result.wrong}</b> • Toplam: <b>{result.total}</b></p>
              <p>Puan: <b>{result.score}</b></p>
              <button type="button" onClick={() => { setStep("select"); setSorular([]); setSecimler({}); }}>Yeni Test</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SoruCard({ soru, seciliId, onChoose }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ fontWeight: 600 }}>{soru.metin}</div>

      {soru.konular?.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {soru.konular.map((k) => (
            <span
              key={k.id}
              style={{ fontSize: 12, background: "#eef2ff", color: "#3730a3", padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb" }}
            >
              {k.ad}
            </span>
          ))}
        </div>
      )}

      {soru.imageUrl && (
        <img src={fileUrl(soru.imageUrl)} alt="soru" style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }} />
      )}

      {(soru.secenekler || []).map((opt) => (
        <label key={opt.id} style={{ display: "block", marginTop: 6, cursor: "pointer" }}>
          <input
            type="radio"
            name={`q_${soru.id}`}
            value={opt.id}
            checked={seciliId === opt.id}
            onChange={() => onChoose(soru.id, opt.id)}
          />{" "}
          {opt.siralama ? `${opt.siralama}) ` : ""}{opt.metin}
        </label>
      ))}
    </div>
  );
}
