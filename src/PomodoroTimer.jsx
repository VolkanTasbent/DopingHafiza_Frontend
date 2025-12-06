import { useState, useEffect, useRef, useCallback } from "react";
import api from "./services/api";
import "./PomodoroTimer.css";

const WORK_TIME = 25 * 60; // 25 dakika (saniye cinsinden)
const SHORT_BREAK = 5 * 60; // 5 dakika
const LONG_BREAK = 15 * 60; // 15 dakika
const POMODOROS_FOR_LONG_BREAK = 4;

const POMODORO_STORAGE_KEY = "pomodoroTimerState";

// localStorage'dan pomodoro state'ini yükle
const loadPomodoroState = () => {
  try {
    const saved = localStorage.getItem(POMODORO_STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      // Eğer timer çalışıyorsa, geçen süreyi hesapla
      if (state.isRunning && state.startTime) {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        if (state.timerType === "pomodoro") {
          state.timeLeft = Math.max(0, state.timeLeft - elapsed);
        } else {
          state.stopwatchTime = state.stopwatchTime + elapsed;
        }
        state.startTime = Date.now(); // Yeni başlangıç zamanı
      }
      return state;
    }
  } catch (e) {
    console.error("Pomodoro state yüklenemedi:", e);
  }
  return null;
};

// localStorage'a pomodoro state'ini kaydet
const savePomodoroState = (state) => {
  try {
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Pomodoro state kaydedilemedi:", e);
  }
};

export default function PomodoroTimer({ onBack, isWidget = false, onNavigate, me }) {
  // localStorage'dan state'i yükle
  const initialState = loadPomodoroState();
  
  const [timerType, setTimerType] = useState(initialState?.timerType || "pomodoro");
  const [timeLeft, setTimeLeft] = useState(initialState?.timeLeft ?? WORK_TIME);
  const [stopwatchTime, setStopwatchTime] = useState(initialState?.stopwatchTime || 0);
  const [isRunning, setIsRunning] = useState(initialState?.isRunning || false);
  const [mode, setMode] = useState(initialState?.mode || "work");
  const [completedPomodoros, setCompletedPomodoros] = useState(initialState?.completedPomodoros || 0);
  const [sessionPomodoros, setSessionPomodoros] = useState(initialState?.sessionPomodoros || 0);
  const [startTime, setStartTime] = useState(initialState?.startTime || null);
  
  // İstatistikler
  const [stats, setStats] = useState({
    today: { count: 0, minutes: 0 },
    week: { count: 0, minutes: 0 },
    month: { count: 0, minutes: 0 },
    total: { count: 0, minutes: 0 }
  });
  
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);

  // İstatistikleri yükle
  useEffect(() => {
    loadStats();
  }, []);
  
  // State değiştiğinde localStorage'a kaydet (debounce ile)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const state = {
        timerType,
        timeLeft,
        stopwatchTime,
        isRunning,
        mode,
        completedPomodoros,
        sessionPomodoros,
        startTime
      };
      savePomodoroState(state);
    }, 100); // 100ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [timerType, timeLeft, stopwatchTime, isRunning, mode, completedPomodoros, sessionPomodoros, startTime]);
  
  // Diğer component'lerden gelen state değişikliklerini dinle
  useEffect(() => {
    let isUpdating = false; // Sonsuz döngüyü önlemek için
    let lastStateHash = ''; // Son state'in hash'i
    
    const handleStorageChange = () => {
      if (isUpdating) return; // Zaten güncelleniyorsa atla
      
      const savedState = loadPomodoroState();
      if (!savedState) return;
      
      // State hash'i oluştur (değişiklik kontrolü için)
      const stateHash = JSON.stringify({
        timerType: savedState.timerType,
        isRunning: savedState.isRunning,
        mode: savedState.mode
      });
      
      // Eğer aynı state ise güncelleme yapma
      if (stateHash === lastStateHash) return;
      lastStateHash = stateHash;
      
      isUpdating = true;
      
      // Sadece gerçekten farklıysa güncelle (batch update)
      const updates = [];
      if (timerType !== savedState.timerType) updates.push(() => setTimerType(savedState.timerType));
      if (timeLeft !== savedState.timeLeft) updates.push(() => setTimeLeft(savedState.timeLeft));
      if (stopwatchTime !== savedState.stopwatchTime) updates.push(() => setStopwatchTime(savedState.stopwatchTime));
      if (isRunning !== savedState.isRunning) updates.push(() => setIsRunning(savedState.isRunning));
      if (mode !== savedState.mode) updates.push(() => setMode(savedState.mode));
      if (completedPomodoros !== (savedState.completedPomodoros || 0)) updates.push(() => setCompletedPomodoros(savedState.completedPomodoros || 0));
      if (sessionPomodoros !== (savedState.sessionPomodoros || 0)) updates.push(() => setSessionPomodoros(savedState.sessionPomodoros || 0));
      if (startTime !== savedState.startTime) updates.push(() => setStartTime(savedState.startTime));
      
      // Tüm güncellemeleri aynı anda yap
      if (updates.length > 0) {
        updates.forEach(update => update());
      }
      
      setTimeout(() => { isUpdating = false; }, 200);
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Custom event ile aynı sayfadaki diğer component'leri de güncelle (debounce ile)
    let eventTimeout;
    const handleCustomEvent = () => {
      clearTimeout(eventTimeout);
      eventTimeout = setTimeout(handleStorageChange, 100);
    };
    window.addEventListener('pomodoroStateChange', handleCustomEvent);
    
    // Periyodik kontrolü kaldırdık - sadece event'ler yeterli
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pomodoroStateChange', handleCustomEvent);
      clearTimeout(eventTimeout);
    };
  }, [timerType, timeLeft, stopwatchTime, isRunning, mode, completedPomodoros, sessionPomodoros, startTime]);

  // handleTimerComplete'i useCallback ile sarmala
  const handleTimerComplete = useCallback(async () => {
    setIsRunning(false);
    setStartTime(null);
    playSound();
    
    if (mode === "work") {
      const newCount = completedPomodoros + 1;
      const newSessionCount = sessionPomodoros + 1;
      
      setCompletedPomodoros(newCount);
      setSessionPomodoros(newSessionCount);
      
      // Backend'e kaydet
      await savePomodoroSession(25); // 25 dakika çalışma
      
      // İstatistikleri güncelle
      await loadStats();
      
      // Dashboard'ı bilgilendir (event ile)
      window.dispatchEvent(new CustomEvent('pomodoroCompleted'));
      
      // Uzun mola zamanı mı?
      if (newSessionCount % POMODOROS_FOR_LONG_BREAK === 0) {
        setMode("longBreak");
        setTimeLeft(LONG_BREAK);
      } else {
        setMode("shortBreak");
        setTimeLeft(SHORT_BREAK);
      }
    } else {
      // Mola bitti, çalışmaya dön
      setMode("work");
      setTimeLeft(WORK_TIME);
    }
    
    // State değişikliğini diğer component'lere bildir
    window.dispatchEvent(new CustomEvent('pomodoroStateChange'));
  }, [mode, completedPomodoros, sessionPomodoros, me]);
  
  // Timer mantığı - Pomodoro modu
  useEffect(() => {
    if (timerType === "pomodoro" && isRunning && timeLeft > 0) {
      if (!startTime) {
        setStartTime(Date.now());
      }
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerType === "stopwatch" && isRunning) {
      if (!startTime) {
        setStartTime(Date.now());
      }
      // Kronometre modu - ileriye sayar
      intervalRef.current = setInterval(() => {
        setStopwatchTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (!isRunning) {
        setStartTime(null);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft, timerType, startTime, handleTimerComplete]);

  // Ses çal (timer bittiğinde)
  const playSound = () => {
    try {
      // Web Audio API ile basit bir bip sesi
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.log("Ses çalınamadı:", e);
    }
  };


  const savePomodoroSession = async (minutes) => {
    try {
      await api.post("/api/pomodoro/session", {
        duration: minutes,
        completedAt: new Date().toISOString()
      });
      console.log("Pomodoro backend'e kaydedildi:", minutes, "dakika");
    } catch (error) {
      console.error("Pomodoro kaydedilemedi:", error);
      // Hata olsa bile devam et, local storage'a kaydet (kullanıcıya özel)
      const userId = me?.id || "guest";
      const storageKey = `pomodoroStats_${userId}`;
      const localStats = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem("pomodoroStats") || "{}");
      const today = new Date().toISOString().split("T")[0];
      if (!localStats[today]) localStats[today] = { count: 0, minutes: 0 };
      localStats[today].count += 1;
      localStats[today].minutes += minutes;
      localStorage.setItem(storageKey, JSON.stringify(localStats));
      console.log("Pomodoro localStorage'a kaydedildi (kullanıcıya özel):", minutes, "dakika");
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get("/api/pomodoro/stats");
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("İstatistikler yüklenemedi:", error);
      // Local storage'dan yükle (kullanıcıya özel)
      const userId = me?.id || "guest";
      const storageKey = `pomodoroStats_${userId}`;
      const localStats = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem("pomodoroStats") || "{}");
      const today = new Date().toISOString().split("T")[0];
      const todayStats = localStats[today] || { count: 0, minutes: 0 };
      
      // Son 7 günü hesapla
      const weekStats = { count: 0, minutes: 0 };
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      Object.keys(localStats).forEach(dateKey => {
        const date = new Date(dateKey);
        if (date >= weekAgo) {
          const dayStats = localStats[dateKey];
          weekStats.count += dayStats?.count || 0;
          weekStats.minutes += dayStats?.minutes || 0;
        }
      });
      
      // Basit hesaplama (tam doğru olmayabilir ama fallback)
      setStats({
        today: todayStats,
        week: weekStats,
        month: { count: Object.values(localStats).reduce((sum, s) => sum + (s.count || 0), 0), minutes: Object.values(localStats).reduce((sum, s) => sum + (s.minutes || 0), 0) },
        total: { count: Object.values(localStats).reduce((sum, s) => sum + (s.count || 0), 0), minutes: Object.values(localStats).reduce((sum, s) => sum + (s.minutes || 0), 0) }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (isRunning) return; // Zaten çalışıyorsa atla
    
    const newStartTime = Date.now();
    setIsRunning(true);
    setStartTime(newStartTime);
    
    // State'i hemen localStorage'a kaydet
    const currentState = {
      timerType,
      timeLeft,
      stopwatchTime,
      isRunning: true,
      mode,
      completedPomodoros,
      sessionPomodoros,
      startTime: newStartTime
    };
    savePomodoroState(currentState);
    
    // State değişikliğini diğer component'lere bildir
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('pomodoroStateChange'));
    });
  };

  const handlePause = () => {
    if (!isRunning) return; // Zaten durmuşsa atla
    
    setIsRunning(false);
    setStartTime(null);
    
    // State'i hemen localStorage'a kaydet
    const currentState = {
      timerType,
      timeLeft,
      stopwatchTime,
      isRunning: false,
      mode,
      completedPomodoros,
      sessionPomodoros,
      startTime: null
    };
    savePomodoroState(currentState);
    
    // State değişikliğini diğer component'lere bildir
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('pomodoroStateChange'));
    });
  };

  const handleReset = async () => {
    setIsRunning(false);
    setStartTime(null);
    
    if (timerType === "stopwatch") {
      // Kronometre modunda, durdurulan süreyi kaydet
      if (stopwatchTime > 0) {
        const minutes = Math.floor(stopwatchTime / 60);
        if (minutes >= 1) { // En az 1 dakika çalıştıysa kaydet
          await savePomodoroSession(minutes);
          await loadStats();
          window.dispatchEvent(new CustomEvent('pomodoroCompleted'));
        }
      }
      setStopwatchTime(0);
    } else {
      // Pomodoro modunda
      if (mode === "work") {
        // Çalışma modundaysa, geçen süreyi kaydet
        const elapsedMinutes = Math.floor((WORK_TIME - timeLeft) / 60);
        if (elapsedMinutes >= 1) { // En az 1 dakika çalıştıysa kaydet
          await savePomodoroSession(elapsedMinutes);
          await loadStats();
          window.dispatchEvent(new CustomEvent('pomodoroCompleted'));
        }
        setTimeLeft(WORK_TIME);
      } else if (mode === "shortBreak") {
        setTimeLeft(SHORT_BREAK);
      } else {
        setTimeLeft(LONG_BREAK);
      }
    }
    // State değişikliğini diğer component'lere bildir
    window.dispatchEvent(new CustomEvent('pomodoroStateChange'));
  };

  const handleModeChange = (newMode) => {
    if (isRunning) {
      // Çalışırken mod değiştirilemez, önce durdur
      setIsRunning(false);
      setStartTime(null);
    }
    
    setMode(newMode);
    if (newMode === "work") {
      setTimeLeft(WORK_TIME);
    } else if (newMode === "shortBreak") {
      setTimeLeft(SHORT_BREAK);
    } else {
      setTimeLeft(LONG_BREAK);
    }
    
    // State'i hemen localStorage'a kaydet
    const currentState = {
      timerType,
      timeLeft: newMode === "work" ? WORK_TIME : newMode === "shortBreak" ? SHORT_BREAK : LONG_BREAK,
      stopwatchTime,
      isRunning: false,
      mode: newMode,
      completedPomodoros,
      sessionPomodoros,
      startTime: null
    };
    savePomodoroState(currentState);
    
    // State değişikliğini diğer component'lere bildir
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('pomodoroStateChange'));
    });
  };

  const handleTimerTypeChange = (type) => {
    if (isRunning) {
      // Çalışırken tip değiştirilemez, önce durdur
      setIsRunning(false);
      setStartTime(null);
    }
    
    setTimerType(type);
    if (type === "stopwatch") {
      setStopwatchTime(0);
    } else {
      // Pomodoro moduna dönünce mevcut moda göre zamanı ayarla
      if (mode === "work") {
        setTimeLeft(WORK_TIME);
      } else if (mode === "shortBreak") {
        setTimeLeft(SHORT_BREAK);
      } else {
        setTimeLeft(LONG_BREAK);
      }
    }
    
    // State'i hemen localStorage'a kaydet
    const currentState = {
      timerType: type,
      timeLeft: type === "stopwatch" ? WORK_TIME : (mode === "work" ? WORK_TIME : mode === "shortBreak" ? SHORT_BREAK : LONG_BREAK),
      stopwatchTime: type === "stopwatch" ? 0 : stopwatchTime,
      isRunning: false,
      mode,
      completedPomodoros,
      sessionPomodoros,
      startTime: null
    };
    savePomodoroState(currentState);
    
    // State değişikliğini diğer component'lere bildir
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('pomodoroStateChange'));
    });
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const progress = mode === "work" ? ((WORK_TIME - timeLeft) / WORK_TIME) * 100 : 
                   mode === "shortBreak" ? ((SHORT_BREAK - timeLeft) / SHORT_BREAK) * 100 :
                   ((LONG_BREAK - timeLeft) / LONG_BREAK) * 100;

  if (isWidget) {
    // Widget modu (Dashboard için)
    return (
      <div className="pomodoro-widget">
        <div className="pomodoro-widget-header">
          <span className="pomodoro-icon">
            {timerType === "pomodoro" ? "🍅" : "⏱️"}
          </span>
          <span className="pomodoro-title">
            {timerType === "pomodoro" 
              ? (mode === "work" ? "Pomodoro" : mode === "shortBreak" ? "Kısa Mola" : "Uzun Mola")
              : "Kronometre"}
          </span>
          <button
            className="pomodoro-widget-type-toggle"
            onClick={() => handleTimerTypeChange(timerType === "pomodoro" ? "stopwatch" : "pomodoro")}
            disabled={isRunning}
            title={timerType === "pomodoro" ? "Kronometre'ye geç" : "Pomodoro'ya geç"}
          >
            🔄
          </button>
        </div>
        
        {/* Pomodoro modunda mod seçimi */}
        {timerType === "pomodoro" && (
          <div className="pomodoro-widget-modes">
            <button
              className={`pomodoro-mode-btn ${mode === "work" ? "active" : ""}`}
              onClick={() => handleModeChange("work")}
              disabled={isRunning}
              title="Çalışma"
            >
              🍅
            </button>
            <button
              className={`pomodoro-mode-btn ${mode === "shortBreak" ? "active" : ""}`}
              onClick={() => handleModeChange("shortBreak")}
              disabled={isRunning}
              title="Kısa Mola"
            >
              ☕
            </button>
            <button
              className={`pomodoro-mode-btn ${mode === "longBreak" ? "active" : ""}`}
              onClick={() => handleModeChange("longBreak")}
              disabled={isRunning}
              title="Uzun Mola"
            >
              🌴
            </button>
          </div>
        )}
        
        <div className="pomodoro-widget-timer">
          <div className="pomodoro-time-display-small">
            {timerType === "pomodoro" ? formatTime(timeLeft) : formatTime(stopwatchTime)}
          </div>
          <div className="pomodoro-widget-controls">
            {!isRunning ? (
              <button className="pomodoro-btn-small" onClick={handleStart}>
                ▶️
              </button>
            ) : (
              <button className="pomodoro-btn-small" onClick={handlePause}>
                ⏸️
              </button>
            )}
            <button className="pomodoro-btn-small" onClick={handleReset}>
              🔄
            </button>
            {/* Kronometre modunda sıfırla butonu */}
            {timerType === "stopwatch" && stopwatchTime === 0 && !isRunning && (
              <button 
                className="pomodoro-btn-small" 
                onClick={() => {
                  setStopwatchTime(0);
                  const currentState = {
                    timerType,
                    timeLeft,
                    stopwatchTime: 0,
                    isRunning: false,
                    mode,
                    completedPomodoros,
                    sessionPomodoros,
                    startTime: null
                  };
                  savePomodoroState(currentState);
                  window.dispatchEvent(new CustomEvent('pomodoroStateChange'));
                }}
                title="Sıfırla"
              >
                ⏹️
              </button>
            )}
          </div>
        </div>
        <div className="pomodoro-widget-stats">
          <div className="pomodoro-stat-item">
            <span className="stat-label">Bugün</span>
            <span className="stat-value">{stats.today.count}</span>
          </div>
          <div className="pomodoro-stat-item">
            <span className="stat-label">Bu Hafta</span>
            <span className="stat-value">{stats.week.count}</span>
          </div>
        </div>
        <button 
          className="pomodoro-widget-link"
          onClick={() => {
            if (onNavigate) {
              onNavigate("pomodoro");
            } else if (onBack) {
              // Fallback: eğer onNavigate yoksa onBack kullan
              window.location.hash = "pomodoro";
            }
          }}
        >
          Detaylı Görünüm →
        </button>
      </div>
    );
  }

  // Tam sayfa modu
  return (
    <div className="pomodoro-container">
      <div className="pomodoro-header">
        {onBack && (
          <button className="pomodoro-back-btn" onClick={onBack}>
            ← Geri
          </button>
        )}
        <h1 className="pomodoro-page-title">🍅 Pomodoro Timer</h1>
      </div>

      <div className="pomodoro-content">
        {/* Timer Tipi Seçimi */}
        <div className="pomodoro-type-selector">
          <button
            className={`type-btn ${timerType === "pomodoro" ? "active" : ""}`}
            onClick={() => handleTimerTypeChange("pomodoro")}
            disabled={isRunning}
          >
            🍅 Pomodoro
          </button>
          <button
            className={`type-btn ${timerType === "stopwatch" ? "active" : ""}`}
            onClick={() => handleTimerTypeChange("stopwatch")}
            disabled={isRunning}
          >
            ⏱️ Kronometre
          </button>
        </div>

        {/* Pomodoro Mod Seçimi - Sadece pomodoro modunda görünür */}
        {timerType === "pomodoro" && (
          <div className="pomodoro-mode-selector">
            <button
              className={`mode-btn ${mode === "work" ? "active" : ""}`}
              onClick={() => handleModeChange("work")}
              disabled={isRunning}
            >
              💼 Çalışma
            </button>
            <button
              className={`mode-btn ${mode === "shortBreak" ? "active" : ""}`}
              onClick={() => handleModeChange("shortBreak")}
              disabled={isRunning}
            >
              ☕ Kısa Mola
            </button>
            <button
              className={`mode-btn ${mode === "longBreak" ? "active" : ""}`}
              onClick={() => handleModeChange("longBreak")}
              disabled={isRunning}
            >
              🌴 Uzun Mola
            </button>
          </div>
        )}

        {/* Timer */}
        <div className="pomodoro-timer-wrapper">
          <div className="pomodoro-circle">
            {timerType === "pomodoro" ? (
              <>
                <svg className="pomodoro-svg" viewBox="0 0 100 100">
                  <circle
                    className="pomodoro-circle-bg"
                    cx="50"
                    cy="50"
                    r="45"
                  />
                  <circle
                    className="pomodoro-circle-progress"
                    cx="50"
                    cy="50"
                    r="45"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 45}`,
                      strokeDashoffset: `${2 * Math.PI * 45 * (1 - (mode === "work" ? progress / 100 : (mode === "shortBreak" ? (SHORT_BREAK - timeLeft) / SHORT_BREAK : (LONG_BREAK - timeLeft) / LONG_BREAK)))})`,
                    }}
                  />
                </svg>
                <div className="pomodoro-time-display">
                  <div className="time-text">{formatTime(timeLeft)}</div>
                  <div className="mode-text">
                    {mode === "work" ? "Çalışma Zamanı" : mode === "shortBreak" ? "Kısa Mola" : "Uzun Mola"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <svg className="pomodoro-svg" viewBox="0 0 100 100">
                  <circle
                    className="pomodoro-circle-bg"
                    cx="50"
                    cy="50"
                    r="45"
                  />
                  <circle
                    className="pomodoro-circle-progress stopwatch"
                    cx="50"
                    cy="50"
                    r="45"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 45}`,
                      strokeDashoffset: `${2 * Math.PI * 45 * (1 - Math.min(stopwatchTime / (60 * 60), 1))})`, // 1 saat max progress
                    }}
                  />
                </svg>
                <div className="pomodoro-time-display">
                  <div className="time-text">{formatTime(stopwatchTime)}</div>
                  <div className="mode-text">Kronometre</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Kontroller */}
        <div className="pomodoro-controls">
          {!isRunning ? (
            <button className="pomodoro-btn-primary" onClick={handleStart}>
              ▶️ Başlat
            </button>
          ) : (
            <button className="pomodoro-btn-primary pause" onClick={handlePause}>
              ⏸️ Duraklat
            </button>
          )}
          <button className="pomodoro-btn-secondary" onClick={handleReset}>
            🔄 Sıfırla
          </button>
        </div>

        {/* Oturum İstatistikleri */}
        <div className="pomodoro-session-stats">
          <div className="session-stat-card">
            <div className="session-stat-icon">🍅</div>
            <div className="session-stat-info">
              <div className="session-stat-label">Bu Oturum</div>
              <div className="session-stat-value">{sessionPomodoros}</div>
            </div>
          </div>
          <div className="session-stat-card">
            <div className="session-stat-icon">⭐</div>
            <div className="session-stat-info">
              <div className="session-stat-label">Toplam</div>
              <div className="session-stat-value">{completedPomodoros}</div>
            </div>
          </div>
        </div>

        {/* İstatistikler */}
        {!loading && (
          <div className="pomodoro-stats-grid">
            <div className="pomodoro-stat-card">
              <div className="stat-card-header">
                <span className="stat-card-icon">📅</span>
                <span className="stat-card-title">Bugün</span>
              </div>
              <div className="stat-card-content">
                <div className="stat-card-value">{stats.today.count}</div>
                <div className="stat-card-label">Pomodoro</div>
                <div className="stat-card-minutes">{stats.today.minutes} dakika</div>
              </div>
            </div>

            <div className="pomodoro-stat-card">
              <div className="stat-card-header">
                <span className="stat-card-icon">📊</span>
                <span className="stat-card-title">Bu Hafta</span>
              </div>
              <div className="stat-card-content">
                <div className="stat-card-value">{stats.week.count}</div>
                <div className="stat-card-label">Pomodoro</div>
                <div className="stat-card-minutes">{stats.week.minutes} dakika</div>
              </div>
            </div>

            <div className="pomodoro-stat-card">
              <div className="stat-card-header">
                <span className="stat-card-icon">📈</span>
                <span className="stat-card-title">Bu Ay</span>
              </div>
              <div className="stat-card-content">
                <div className="stat-card-value">{stats.month.count}</div>
                <div className="stat-card-label">Pomodoro</div>
                <div className="stat-card-minutes">{stats.month.minutes} dakika</div>
              </div>
            </div>

            <div className="pomodoro-stat-card">
              <div className="stat-card-header">
                <span className="stat-card-icon">🏆</span>
                <span className="stat-card-title">Toplam</span>
              </div>
              <div className="stat-card-content">
                <div className="stat-card-value">{stats.total.count}</div>
                <div className="stat-card-label">Pomodoro</div>
                <div className="stat-card-minutes">{stats.total.minutes} dakika</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

