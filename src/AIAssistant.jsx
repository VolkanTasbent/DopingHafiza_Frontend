import { useCallback, useEffect, useRef, useState } from "react";
import api from "./services/api";
import { loadSavedPlans, removeSavedPlan, saveStudyPlanEntry } from "./services/aiCoachStorage";

const PRESET = [
  { label: "Eksiklerim neler?", text: "Eksiklerim neler?" },
  { label: "30 dk hizli plan", text: "30 dakikada hizli plan hazirla" },
  { label: "Deneme analizi", text: "Deneme analizi yap" },
  { label: "Bugun program", text: "Bugun calisma programi olustur" },
];

export default function AIAssistant({ onBack }) {
  const bottomRef = useRef(null);
  const [days, setDays] = useState(30);
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const [analysis, setAnalysis] = useState(null);
  const [plan, setPlan] = useState(null);
  const [abCompare, setAbCompare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [sending, setSending] = useState(false);
  const [savedPlans, setSavedPlans] = useState([]);

  const reloadSaved = useCallback(() => {
    loadSavedPlans()
      .then(setSavedPlans)
      .catch(() => setSavedPlans([]));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, pRes] = await Promise.all([
        api.get("/api/ai/analyze-weak-topics", { params: { days, limit: 8 } }),
        api.get("/api/ai/suggest-study-plan", { params: { days, dailyMinutes, mode: "mixed" } }),
      ]);
      setAnalysis(aRes.data || null);
      setPlan(pRes.data || null);
      try {
        const { data } = await api.get("/api/ai/ab-compare", { params: { days, limit: 6 } });
        setAbCompare(data || null);
      } catch {
        setAbCompare(null);
      }
    } catch (e) {
      console.error("AI ekrani yuklenemedi", e);
      alert("AI verileri yuklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    reloadSaved();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const sendChat = async (text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    setSending(true);
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setMessage("");
    try {
      const { data } = await api.post("/api/ai/chat", { message: trimmed });
      setMessages((m) => [...m, { role: "assistant", text: data?.answer || "" }]);
      setQuickReplies(Array.isArray(data?.quickReplies) ? data.quickReplies : []);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Baglanti hatasi. Backend (8085) calisiyor mu kontrol et." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onSavePlan = async () => {
    if (!plan?.tasks?.length) {
      alert("Once analizi yenile; kaydedilecek program yok.");
      return;
    }
    try {
      await saveStudyPlanEntry(plan, analysis, {});
      reloadSaved();
      alert("Program sunucuya kaydedildi.");
    } catch {
      alert("Kayit basarisiz. Giris yaptigindan ve backend acik oldugundan emin ol.");
    }
  };

  const ui = {
    shell: { display: "grid", gap: 14 },
    hero: {
      borderRadius: 18,
      padding: 22,
      color: "#fff",
      background: "linear-gradient(135deg, #111827 0%, #312e81 100%)",
      boxShadow: "0 16px 36px rgba(15,23,42,0.24)",
    },
    heroTitle: { marginTop: 0, color: "#fff", fontSize: 24, fontWeight: 800 },
    heroSub: { color: "#cbd5e1", marginTop: 4, marginBottom: 12 },
    metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 },
    metricPill: { borderRadius: 12, padding: "10px 12px", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)" },
    metricLabel: { color: "#cbd5e1", fontSize: 12, fontWeight: 600 },
    metricValue: { color: "#fff", fontSize: 16, fontWeight: 800 },
    controls: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
    input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" },
    primaryBtn: { padding: "10px 14px", borderRadius: 10, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", fontWeight: 700 },
    ghostBtn: { padding: "10px 14px", borderRadius: 10, border: "1px solid #334155", background: "#fff", color: "#334155", fontWeight: 700 },
    sectionTitle: { fontSize: 20, marginBottom: 10 },
    list: { display: "grid", gap: 10 },
    row: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#fcfdff" },
    rowTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
    rowTitle: { fontWeight: 700 },
    meta: { fontSize: 13, color: "#64748b", marginTop: 2 },
    riskPill: { borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 800, background: "#ffedd5", color: "#9a3412" },
    sourcePill: { borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 700, background: "#e0e7ff", color: "#3730a3", marginLeft: 6 },
    chatBox: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
    bubbleUser: { alignSelf: "flex-end", background: "#4f46e5", color: "#fff", padding: 12, borderRadius: 14, maxWidth: "92%", whiteSpace: "pre-wrap" },
    bubbleAsst: { alignSelf: "flex-start", background: "#f8fafc", border: "1px solid #e2e8f0", padding: 12, borderRadius: 14, maxWidth: "92%", whiteSpace: "pre-wrap", lineHeight: 1.55 },
    thread: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
    presetRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    chip: { padding: "8px 12px", borderRadius: 999, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#3730a3", fontWeight: 700, fontSize: 13, cursor: "pointer" },
    savedCard: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 10, background: "#fafbff" },
    planHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  };

  return (
    <div style={ui.shell}>
      <div style={ui.hero}>
        <h2 style={ui.heroTitle}>AI Ders Kocu</h2>
        <p style={ui.heroSub}>Sohbet, eksik analizi ve kayitli programlar — verilerinizle kisisel oneriler</p>
        <div style={ui.metrics}>
          <div style={ui.metricPill}>
            <div style={ui.metricLabel}>Analiz gunu</div>
            <div style={ui.metricValue}>{analysis?.analyzedDays || days}</div>
          </div>
          <div style={ui.metricPill}>
            <div style={ui.metricLabel}>Toplam cevap</div>
            <div style={ui.metricValue}>{analysis?.totalAnswers ?? 0}</div>
          </div>
          <div style={ui.metricPill}>
            <div style={ui.metricLabel}>Ortalama basari</div>
            <div style={ui.metricValue}>%{analysis?.overallSuccessRate ?? "-"}</div>
          </div>
        </div>
        <div style={ui.controls}>
          <input type="number" min={7} value={days} onChange={(e) => setDays(Number(e.target.value || 30))} style={ui.input} placeholder="Analiz gunu" />
          <input type="number" min={30} value={dailyMinutes} onChange={(e) => setDailyMinutes(Number(e.target.value || 120))} style={ui.input} placeholder="Gunluk dakika" />
          <button type="button" onClick={load} disabled={loading} style={ui.primaryBtn}>
            {loading ? "Yukleniyor..." : "Analizi yenile"}
          </button>
          {onBack ? (
            <button type="button" onClick={onBack} style={ui.ghostBtn}>
              Geri
            </button>
          ) : null}
        </div>
      </div>

      <div className="card">
        <h3 style={ui.sectionTitle}>AI asistan sohbeti</h3>
        <p style={{ color: "#64748b", marginTop: 0 }}>Hazir aksiyonlar mesaji otomatik gonderir. Cevaplar cok satirli olabilir.</p>
        <div style={ui.presetRow}>
          {PRESET.map((p) => (
            <button key={p.label} type="button" style={ui.chip} onClick={() => sendChat(p.text)} disabled={sending}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={ui.thread}>
          {messages.length === 0 ? (
            <p style={{ color: "#64748b" }}>Henuz mesaj yok. Yukaridaki bir aksiyona tikla veya asagiya yaz.</p>
          ) : (
            messages.map((msg, i) => (
              <div key={`m-${i}`} style={msg.role === "user" ? ui.bubbleUser : ui.bubbleAsst}>
                {msg.text}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <div style={ui.chatBox}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat(message)}
            placeholder="Mesaj yaz..."
            style={{ ...ui.input, flex: 1, minWidth: 220 }}
          />
          <button type="button" onClick={() => sendChat(message)} disabled={sending} style={ui.primaryBtn}>
            {sending ? "..." : "Gonder"}
          </button>
        </div>
        {quickReplies.length > 0 ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Onerilen sonraki sorular</div>
            <div style={ui.presetRow}>
              {quickReplies.map((q) => (
                <button key={q} type="button" style={ui.chip} onClick={() => sendChat(q)} disabled={sending}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3 style={ui.sectionTitle}>Kayitli calisma programlarim</h3>
        <p style={{ color: "#64748b" }}>Programlar hesabina bagli olarak sunucuda saklanir (en fazla 20 kayit).</p>
        {savedPlans.length === 0 ? (
          <p style={{ color: "#64748b" }}>Henuz kayitli program yok.</p>
        ) : (
          savedPlans.map((sp) => (
            <div key={sp.id} style={ui.savedCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong>{sp.title}</strong>
                <button
                  type="button"
                  style={{ ...ui.ghostBtn, padding: "6px 10px" }}
                  onClick={() => removeSavedPlan(sp.id).then(reloadSaved).catch(reloadSaved)}
                >
                  Sil
                </button>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{new Date(sp.savedAt).toLocaleString("tr-TR")}</div>
              <p style={{ margin: "6px 0", color: "#334155" }}>{sp.summary}</p>
              {(sp.tasks || []).slice(0, 8).map((t, i) => (
                <div key={`${sp.id}-t-${i}`} style={{ fontSize: 13, color: "#475569" }}>
                  {i + 1}. {t.title} ({t.estimatedMinutes} dk)
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div style={ui.planHead}>
          <h3 style={{ ...ui.sectionTitle, margin: 0 }}>Kisisel programim</h3>
          <button type="button" onClick={onSavePlan} disabled={loading || !plan?.tasks?.length} style={ui.primaryBtn}>
            Programi kaydet
          </button>
        </div>
        <p style={{ color: "#334155" }}>{plan?.summary || "Program henuz olusmadi."}</p>
        <div style={ui.list}>
          {(plan?.tasks || []).map((task, i) => (
            <div key={`${task.title}-${i}`} style={ui.row}>
              <div style={ui.rowTitle}>
                {i + 1}. {task.title}
              </div>
              <div style={ui.meta}>
                {task.taskType} - {task.estimatedMinutes} dk
              </div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{task.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={ui.sectionTitle}>Eksik konularim</h3>
        {(analysis?.weakTopics || []).length === 0 ? (
          <p style={{ color: "#64748b" }}>Yeterli veri yok.</p>
        ) : (
          <div style={ui.list}>
            {(analysis?.weakTopics || []).map((t, i) => (
              <div key={`${t.konuId || i}`} style={ui.row}>
                <div style={ui.rowTop}>
                  <div style={ui.rowTitle}>
                    {t.dersAd} / {t.konuAd}
                  </div>
                  <div>
                    <span style={ui.riskPill}>Risk %{t.riskScore}</span>
                    <span style={ui.sourcePill}>
                      {t.source || "heuristic"}
                      {t.modelVersion ? ` • ${t.modelVersion}` : ""}
                    </span>
                  </div>
                </div>
                <div style={ui.meta}>Basari %{t.successRate}</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>{t.recommendation}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={ui.sectionTitle}>A/B Karsilastirma (ML vs Heuristic)</h3>
        {abCompare?.topics?.length ? (
          <div style={ui.list}>
            {abCompare.topics.map((x, i) => (
              <div key={`${x.konuId || i}`} style={ui.row}>
                <div style={ui.rowTitle}>
                  {x.dersAd} / {x.konuAd}
                </div>
                <div style={ui.meta}>
                  H: %{x.heuristicRisk} | ML: %{x.mlRisk ?? "-"} | Delta:{" "}
                  <b style={{ color: Number(x.delta || 0) >= 0 ? "#0f766e" : "#b91c1c" }}>{x.delta ?? "-"}</b> | Aktif: {x.activeSource}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "#64748b" }}>A/B verisi su an kullanilamiyor.</p>
        )}
      </div>
    </div>
  );
}
