import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiCoachTheme as t } from "./aiCoachTheme";
import api from "./services/api";
import { loadSavedPlans, removeSavedPlan, saveStudyPlanEntry } from "./services/aiCoachStorage";

export default function AIAssistant({ onBack, me }) {
  const bottomRef = useRef(null);
  const [days, setDays] = useState(30);
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const [analysis, setAnalysis] = useState(null);
  const [plan, setPlan] = useState(null);
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

  const displayName = useMemo(() => {
    const full = `${me?.ad || ""} ${me?.soyad || ""}`.trim();
    return full || me?.ad || "Ogrenci";
  }, [me?.ad, me?.soyad]);

  const hedefText = useMemo(() => {
    const universite = me?.hedefUniversite || me?.hedef?.universite;
    const bolum = me?.hedefBolum || me?.hedef?.bolum;
    if (!universite && !bolum) return "Hedef tanimlanmamis";
    return [universite, bolum].filter(Boolean).join(" / ");
  }, [me]);

  const personalizedPreset = useMemo(() => {
    const weak = analysis?.weakTopics?.[0];
    const weakText = weak?.konuAd
      ? `${weak.dersAd || "Bu ders"} ${weak.konuAd} konusunda bugunluk plan yap`
      : "Bugun program";

    return [
      { label: "Eksiklerim neler?", text: "Eksiklerim neler?" },
      { label: "Bugun program", text: "Bugun calisma programi olustur" },
      { label: "Zayif konu plani", text: weakText },
      { label: "Deneme analizi", text: "Deneme analizi yap" },
    ];
  }, [analysis?.weakTopics]);

  const ui = {
    shell: { display: "grid", gap: 14 },
    hero: {
      borderRadius: 18,
      padding: 22,
      color: "#fff",
      background: t.heroGradient,
      boxShadow: t.heroShadow,
    },
    heroTitle: { marginTop: 0, color: "#fff", fontSize: 24, fontWeight: 800 },
    heroSub: { color: t.heroTextMuted, marginTop: 4, marginBottom: 12 },
    metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 },
    metricPill: { borderRadius: 12, padding: "10px 12px", background: t.heroPillBg, border: `1px solid ${t.heroPillBorder}` },
    metricLabel: { color: t.heroTextMuted, fontSize: 12, fontWeight: 600 },
    metricValue: { color: "#fff", fontSize: 16, fontWeight: 800 },
    controls: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: `1px solid ${t.border}`,
      background: t.cardBg,
      color: t.text,
      caretColor: t.primary,
    },
    primaryBtn: { padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.primaryDark}`, background: t.primary, color: "#fff", fontWeight: 700 },
    ghostBtn: { padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.ghostBorder}`, background: t.ghostBg, color: t.ghostText, fontWeight: 700 },
    sectionTitle: { fontSize: 20, marginBottom: 10 },
    list: { display: "grid", gap: 10 },
    row: { border: `1px solid ${t.border}`, borderRadius: 12, padding: 10, background: t.rowBg },
    rowTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
    rowTitle: { fontWeight: 700 },
    meta: { fontSize: 13, color: t.muted, marginTop: 2 },
    riskPill: { borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 800, background: t.riskBg, color: t.riskText },
    chatBox: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
    bubbleUser: { alignSelf: "flex-end", background: t.bubbleUser, color: "#fff", padding: 12, borderRadius: 14, maxWidth: "92%", whiteSpace: "pre-wrap" },
    bubbleAsst: { alignSelf: "flex-start", background: t.bubbleAsstBg, border: `1px solid ${t.bubbleAsstBorder}`, padding: 12, borderRadius: 14, maxWidth: "92%", whiteSpace: "pre-wrap", lineHeight: 1.55 },
    thread: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
    presetRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    chip: { padding: "8px 12px", borderRadius: 999, border: `1px solid ${t.chipBorder}`, background: t.chipBg, color: t.chipText, fontWeight: 700, fontSize: 13, cursor: "pointer" },
    savedCard: { border: `1px solid ${t.border}`, borderRadius: 12, padding: 12, marginBottom: 10, background: t.savedCardBg },
    planHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  };

  return (
    <div style={ui.shell}>
      <div style={ui.hero}>
        <h2 style={ui.heroTitle}>{displayName} icin AI Ders Kocu</h2>
        <p style={ui.heroSub}>Sohbet, eksik analizi ve kayitli programlar — hesabina gore kisisel oneriler</p>
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
          <div style={ui.metricPill}>
            <div style={ui.metricLabel}>Hedef</div>
            <div style={{ ...ui.metricValue, fontSize: 13 }}>{hedefText}</div>
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
        <p style={{ color: t.muted, marginTop: 0 }}>Hazir aksiyonlar mesaji otomatik gonderir. Cevaplar cok satirli olabilir.</p>
        <div style={ui.presetRow}>
          {personalizedPreset.map((p) => (
            <button key={p.label} type="button" style={ui.chip} onClick={() => sendChat(p.text)} disabled={sending}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={ui.thread}>
          {messages.length === 0 ? (
            <p style={{ color: t.muted }}>Henuz mesaj yok. Yukaridaki bir aksiyona tikla veya asagiya yaz.</p>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: t.muted, marginBottom: 6 }}>Onerilen sonraki sorular</div>
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
        <p style={{ color: t.muted }}>Programlar hesabina bagli olarak sunucuda saklanir (en fazla 20 kayit).</p>
        {savedPlans.length === 0 ? (
          <p style={{ color: t.muted }}>Henuz kayitli program yok.</p>
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
              <div style={{ fontSize: 12, color: t.muted, marginBottom: 6 }}>{new Date(sp.savedAt).toLocaleString("tr-TR")}</div>
              <p style={{ margin: "6px 0", color: t.textBody }}>{sp.summary}</p>
              {(sp.tasks || []).slice(0, 8).map((task, i) => (
                <div key={`${sp.id}-t-${i}`} style={{ fontSize: 13, color: t.textBody }}>
                  {i + 1}. {task.title} ({task.estimatedMinutes} dk)
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
        <p style={{ color: t.textBody }}>{plan?.summary || "Program henuz olusmadi."}</p>
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
          <p style={{ color: t.muted }}>Yeterli veri yok.</p>
        ) : (
          <div style={ui.list}>
            {(analysis?.weakTopics || []).map((t, i) => (
              <div key={`${t.konuId || i}`} style={ui.row}>
                <div style={ui.rowTop}>
                  <div style={ui.rowTitle}>
                    {t.dersAd} / {t.konuAd}
                  </div>
                  <span style={ui.riskPill}>Risk %{t.riskScore}</span>
                </div>
                <div style={ui.meta}>Basari %{t.successRate}</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>{t.recommendation}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
