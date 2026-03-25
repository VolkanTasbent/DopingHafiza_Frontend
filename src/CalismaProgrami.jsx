import { useCallback, useEffect, useMemo, useState } from "react";
import api from "./services/api";
import { loadSavedPlans } from "./services/aiCoachStorage";
import {
  assignTasksToWeekCalendar,
  loadWeekdayAvailability,
  saveWeekdayAvailability,
} from "./utils/calismaProgramiSchedule";
import "./Takvim.css";
import "./CalismaProgrami.css";

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function CalismaProgrami({ onBack }) {
  const [selectedWeek, setSelectedWeek] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [savedPlans, setSavedPlans] = useState([]);
  const [aiPlan, setAiPlan] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [activeLabel, setActiveLabel] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const [planDays, setPlanDays] = useState(30);
  const [scheduleDailyCap, setScheduleDailyCap] = useState(120);
  const [availableWeekdays, setAvailableWeekdays] = useState(loadWeekdayAvailability);

  const reloadSaved = useCallback(() => {
    loadSavedPlans()
      .then(setSavedPlans)
      .catch(() => setSavedPlans([]));
  }, []);

  const loadAiPlan = useCallback(async () => {
    const { data } = await api.get("/api/ai/suggest-study-plan", {
      params: { days: planDays, dailyMinutes, mode: "mixed" },
    });
    return data;
  }, [planDays, dailyMinutes]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [saved, ai] = await Promise.all([
          loadSavedPlans().catch(() => []),
          loadAiPlan().catch(() => null),
        ]);
        if (!alive) return;
        setSavedPlans(saved);
        setAiPlan(ai);
        if (ai?.tasks?.length) {
          setActivePlan(ai);
          setActiveLabel("AI onerisi (guncel)");
          if (ai.dailyMinutes != null) setScheduleDailyCap(Number(ai.dailyMinutes) || 120);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const weekStart = useMemo(() => startOfWeekMonday(selectedWeek), [selectedWeek]);

  const scheduleResult = useMemo(
    () =>
      assignTasksToWeekCalendar(activePlan?.tasks || [], {
        dailyCapMinutes: scheduleDailyCap,
        availableWeekday: availableWeekdays,
      }),
    [activePlan?.tasks, scheduleDailyCap, availableWeekdays]
  );

  const weekColumns = useMemo(() => {
    const { dayBuckets, minutesUsed, overflowByDay } = scheduleResult;
    return DAY_LABELS.map((dayName, index) => {
      const date = addDays(weekStart, index);
      const isToday = new Date().toDateString() === date.toDateString();
      const list = dayBuckets[index] || [];
      const minutes = minutesUsed[index] ?? 0;
      const overflow = overflowByDay[index] ?? 0;
      const unavailable = !availableWeekdays[index];
      return { dayName, date, isToday, tasks: list, minutes, overflow, unavailable };
    });
  }, [weekStart, scheduleResult, availableWeekdays]);

  const scheduleWarnings = useMemo(() => {
    const overflows = weekColumns.filter((c) => c.overflow > 0);
    const unassigned = scheduleResult.unassigned?.length || 0;
    return { overflows, unassigned };
  }, [weekColumns, scheduleResult.unassigned]);

  const totalWeekMinutes = weekColumns.reduce((s, d) => s + d.minutes, 0);

  const goPrevWeek = () => {
    const n = new Date(selectedWeek);
    n.setDate(n.getDate() - 7);
    setSelectedWeek(n);
  };

  const goNextWeek = () => {
    const n = new Date(selectedWeek);
    n.setDate(n.getDate() + 7);
    setSelectedWeek(n);
  };

  const goTodayWeek = () => setSelectedWeek(new Date());

  const weekRangeText = () => {
    const end = addDays(weekStart, 6);
    return {
      start: weekStart.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }),
      end: end.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }),
    };
  };

  const onRefreshAi = async () => {
    setLoading(true);
    try {
      const ai = await loadAiPlan();
      setAiPlan(ai);
      if (ai?.tasks?.length) {
        setActivePlan(ai);
        setActiveLabel("AI onerisi (guncel)");
        if (ai.dailyMinutes != null) setScheduleDailyCap(Number(ai.dailyMinutes) || 120);
      }
    } catch {
      alert("AI programi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const onSelectSaved = (sp) => {
    setActivePlan({
      summary: sp.summary,
      analyzedDays: sp.days,
      dailyMinutes: sp.dailyMinutes,
      mode: sp.mode,
      tasks: sp.tasks || [],
    });
    setActiveLabel(sp.title || "Kayitli program");
    if (sp.dailyMinutes != null) setScheduleDailyCap(Number(sp.dailyMinutes) || 120);
  };

  const toggleWeekday = (index) => {
    setAvailableWeekdays((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      saveWeekdayAvailability(next);
      return next;
    });
  };

  const wr = weekRangeText();

  return (
    <div className="takvim-container cpp-root">
      <div className="takvim-header">
        <div className="takvim-header-left">
          <h1 className="takvim-title">Calisma programi</h1>
          <p className="takvim-subtitle">
            Haftalik takvim — gorevler oncelik ve gunluk dakika sinirina gore musait gunlere atanir
          </p>
        </div>
        {onBack && (
          <button type="button" className="back-button" onClick={onBack}>
            Geri
          </button>
        )}
      </div>

      <div className="cpp-toolbar">
        <div className="cpp-toolbar-row">
          <label className="cpp-label">
            Analiz gunu
            <input
              type="number"
              min={7}
              className="cpp-input"
              value={planDays}
              onChange={(e) => setPlanDays(Number(e.target.value) || 30)}
            />
          </label>
          <label className="cpp-label">
            Gunluk dk (AI)
            <input
              type="number"
              min={30}
              className="cpp-input"
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(Number(e.target.value) || 120)}
            />
          </label>
          <label className="cpp-label">
            Takvim gunluk max
            <input
              type="number"
              min={30}
              max={360}
              className="cpp-input"
              value={scheduleDailyCap}
              onChange={(e) => setScheduleDailyCap(Math.max(30, Math.min(360, Number(e.target.value) || 120)))}
            />
          </label>
          <button type="button" className="cpp-btn-primary" onClick={onRefreshAi} disabled={loading}>
            AI programini yenile
          </button>
          <button type="button" className="cpp-btn-ghost" onClick={reloadSaved}>
            Kayitlari yenile
          </button>
        </div>
        <div className="cpp-active-banner">
          <strong>Aktif plan:</strong> {activeLabel || "Henuz secilmedi"}
          {activePlan?.summary ? <span className="cpp-active-meta"> — {activePlan.summary}</span> : null}
        </div>
        <div className="cpp-weekday-row" role="group" aria-label="Musait calisma gunleri">
          <span className="cpp-weekday-label">Musait gunler</span>
          {DAY_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`cpp-weekday-chip ${availableWeekdays[i] ? "on" : "off"}`}
              onClick={() => toggleWeekday(i)}
              aria-pressed={availableWeekdays[i]}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="cpp-layout">
        <aside className="cpp-saved-panel">
          <h3 className="cpp-saved-title">Kayitli programlar</h3>
          <p className="cpp-saved-hint">Listeden sec; takvimde oncelik ve musait gunlere yerlestirilir.</p>
          {savedPlans.length === 0 ? (
            <p className="cpp-empty">Kayit yok. AI Kocum ekranindan program kaydedin.</p>
          ) : (
            <ul className="cpp-saved-list">
              {savedPlans.map((sp) => (
                <li key={sp.id}>
                  <button type="button" className="cpp-saved-item" onClick={() => onSelectSaved(sp)}>
                    <span className="cpp-saved-item-title">{sp.title}</span>
                    <span className="cpp-saved-item-date">
                      {sp.savedAt ? new Date(sp.savedAt).toLocaleString("tr-TR") : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {aiPlan?.tasks?.length ? (
            <button
              type="button"
              className="cpp-link-ai"
              onClick={() => {
                setActivePlan(aiPlan);
                setActiveLabel("AI onerisi (guncel)");
                if (aiPlan?.dailyMinutes != null) setScheduleDailyCap(Number(aiPlan.dailyMinutes) || 120);
              }}
            >
              AI onerisine don
            </button>
          ) : null}
        </aside>

        <div className="cpp-main">
          <div className="week-navigation">
            <button type="button" className="nav-btn" onClick={goPrevWeek}>
              Onceki hafta
            </button>
            <div className="week-range">
              <span className="week-text">
                {wr.start} - {wr.end}
              </span>
              <button type="button" className="today-btn" onClick={goTodayWeek}>
                Bu hafta
              </button>
            </div>
            <button type="button" className="nav-btn" onClick={goNextWeek}>
              Sonraki hafta
            </button>
          </div>

          <div className="cpp-week-summary">
            Bu hafta toplam: <strong>{totalWeekMinutes} dk</strong>
            <span className="cpp-muted"> — Takvim gunluk ust sinir: {scheduleDailyCap} dk</span>
            <p className="cpp-week-hint">
              Gorunen haftanin gercek tarihlerine yerlestirilir; haftayi degistirdiginizde ayni gorevler o
              haftanin musait gunlerine yeniden dagitilir.
            </p>
          </div>

          {(scheduleWarnings.overflows.length > 0 || scheduleWarnings.unassigned > 0) && (
            <div className="cpp-schedule-warn" role="status">
              {scheduleWarnings.overflows.length > 0 ? (
                <span>
                  Bazı günler günlük üst sınırı aşıyor ({scheduleWarnings.overflows.map((c) => c.dayName).join(", ")}).
                  Müsait gün ekleyin veya &quot;Takvim günlük max&quot; değerini yükseltin.
                </span>
              ) : null}
              {scheduleWarnings.unassigned > 0 ? (
                <span>
                  {scheduleWarnings.unassigned} görev yerleştirilemedi (hiç müsait gün yok).
                </span>
              ) : null}
            </div>
          )}

          {loading && !activePlan?.tasks?.length ? (
            <p className="cpp-loading">Yukleniyor...</p>
          ) : null}

          <div className="calendar-grid cpp-plan-grid">
            {weekColumns.map((col, index) => (
              <div
                key={index}
                className={`calendar-day cpp-plan-day ${col.isToday ? "today" : ""} ${col.tasks.length ? "has-activity" : ""} ${col.unavailable ? "cpp-day-off" : ""} ${col.overflow > 0 ? "cpp-day-over" : ""}`}
              >
                <div className="day-header">
                  <span className="day-name">{col.dayName}</span>
                  <span className="day-number">{col.date.getDate()}</span>
                </div>
                <div className="day-content cpp-day-tasks">
                  {col.unavailable ? <div className="cpp-day-off-badge">Müsait değil</div> : null}
                  {col.minutes > 0 ? (
                    <div className="cpp-day-minutes">
                      {col.minutes} dk
                      {col.overflow > 0 ? (
                        <span className="cpp-overflow-tag">+{col.overflow} taşma</span>
                      ) : null}
                    </div>
                  ) : null}
                  {col.tasks.length === 0 ? (
                    <div className="day-empty">{col.unavailable ? "—" : "Plan yok"}</div>
                  ) : (
                    <ul className="cpp-task-list">
                      {col.tasks.map((t, ti) => (
                        <li key={`${col.date.toISOString()}-${ti}-${t.title}`} className="cpp-task">
                          <span className={`cpp-task-type cpp-type-${String(t.taskType || "x")}`}>{t.taskType || "gorev"}</span>
                          <span className="cpp-task-title">{t.title}</span>
                          <span className="cpp-task-min">{t.estimatedMinutes} dk</span>
                          {t.description ? <p className="cpp-task-desc">{t.description}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="cpp-legend">
            <span><i className="cpp-dot video" /> video</span>
            <span><i className="cpp-dot quiz" /> quiz</span>
            <span><i className="cpp-dot review" /> tekrar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
