// Dashboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import api from "./services/api";
import { Line, Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import "./Dashboard.css";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend
);

export default function Dashboard({ me, onNavigate }) {
  const [raporlar, setRaporlar] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("7"); // Varsayılan: Son 7 gün
  
  // Günlük görevler state
  const [dailyStats, setDailyStats] = useState({
    solved: 0,
    correct: 0,
    sessions: 0
  });
  const [dailyTasks, setDailyTasks] = useState({
    task1: false,
    task2: false,
    task3: false
  });
  
  // Hedefler state
  const [hedef, setHedef] = useState(() => {
    const saved = localStorage.getItem("userHedef");
    return saved ? JSON.parse(saved) : { universite: "", bolum: "", siralamaHedef: 10000 };
  });
  
  // İlerleme hesaplama
  const [ilerlemeYuzdesi, setIlerlemeYuzdesi] = useState(27);
  
  // Takvim widget için haftalık veri
  const [weeklyCalendarData, setWeeklyCalendarData] = useState([]);

  // Grafik verilerini hesapla
  const grafikVerileri = useMemo(() => {
    if (!filtered || filtered.length === 0) {
      return {
        lineLabels: [],
        lineData: [],
        totalDogru: 0,
        totalYanlis: 0,
        totalBos: 0,
        netLabels: [],
        netValues: [],
        pieDogru: 0,
        pieYanlis: 0,
        pieBos: 0,
        hasItems: false,
      };
    }

    // Tarihe göre sıralama
    const sortedRaporlar = [...filtered].sort((a, b) => {
      const ta = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const tb = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return ta - tb;
    });

    const last10 = sortedRaporlar.slice(-10);

    // Son 10 Oturum Başarı
    const lineLabels = last10.map((x, index) => {
      if (x.finishedAt) {
        return new Date(x.finishedAt).toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
        });
      }
      return `Oturum ${index + 1}`;
    });

    const lineData = last10.map((x) => {
      const dogru = x.correctCount || 0;
      const yanlis = x.wrongCount || 0;
      const bos = x.emptyCount || 0;
      const total = dogru + yanlis + bos;
      return total > 0 ? Math.round((dogru / total) * 100) : 0;
    });

    // Toplam Doğru/Yanlış/Boş
    const totalDogru = sortedRaporlar.reduce((t, x) => t + (x.correctCount || 0), 0);
    const totalYanlis = sortedRaporlar.reduce((t, x) => t + (x.wrongCount || 0), 0);
    const totalBos = sortedRaporlar.reduce((t, x) => t + (x.emptyCount || 0), 0);

    // Net Gelişimi
    const netValues = last10.map((x) => {
      const dogru = x.correctCount || 0;
      const yanlis = x.wrongCount || 0;
      return parseFloat((dogru - yanlis / 4).toFixed(2));
    });

    const hasItems = filtered.some((rapor) => rapor.items && rapor.items.length > 0);

    return {
      lineLabels,
      lineData,
      totalDogru,
      totalYanlis,
      totalBos,
      netLabels: lineLabels,
      netValues,
      pieDogru: totalDogru,
      pieYanlis: totalYanlis,
      pieBos: totalBos,
      hasItems,
    };
  }, [filtered]);

  useEffect(() => {
    loadData();
    loadDailyTasks();
    calculateProgress();
    loadWeeklyCalendarData();
  }, []);
  
  useEffect(() => {
    loadWeeklyCalendarData();
  }, [raporlar]);

  useEffect(() => {
    applyFilters();
  }, [raporlar, dateFilter]);
  
  useEffect(() => {
    calculateProgress();
  }, [filtered]);

  const loadData = async () => {
    try {
      const { data } = await api.get("/api/raporlar/grafikler", {
        params: { limit: 200 },
      });

      const processedData = data.map((rapor) => {
        let finishedAtDate = null;
        if (rapor.finishedAt) {
          finishedAtDate = new Date(rapor.finishedAt);
        }

        return {
          oturumId: rapor.oturumId,
          finishedAt: finishedAtDate,
          correctCount: rapor.correctCount || 0,
          wrongCount: rapor.wrongCount || 0,
          emptyCount: rapor.emptyCount || 0,
          durationMs: rapor.durationMs || 0,
          net: rapor.net || 0,
          items: rapor.items || [],
        };
      });

      setRaporlar(processedData);
    } catch (e) {
      console.error("❌ Grafik endpoint başarısız, eski endpoint deneniyor:", e);
      try {
        const { data } = await api.get("/api/raporlar", { params: { limit: 200 } });

        const processedData = data.map((rapor) => {
          let finishedAtDate = null;
          if (rapor.finishedAt) {
            finishedAtDate = new Date(rapor.finishedAt);
          }

          return {
            oturumId: rapor.oturumId,
            finishedAt: finishedAtDate,
            correctCount: rapor.correctCount || 0,
            wrongCount: rapor.wrongCount || 0,
            emptyCount: rapor.emptyCount || 0,
            durationMs: rapor.durationMs || 0,
            net: rapor.net || 0,
            items: [],
          };
        });

        setRaporlar(processedData);
      } catch (fallbackError) {
        console.error("❌ Tüm endpoint'ler başarısız:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let arr = [...raporlar];

    if (dateFilter !== "all") {
      const now = Date.now();
      let days = 7; // Varsayılan

      if (dateFilter === "1") days = 1; // Günlük
      else if (dateFilter === "7") days = 7; // Haftalık
      else if (dateFilter === "30") days = 30; // Aylık

      const threshold = days * 24 * 60 * 60 * 1000;

      arr = arr.filter((r) => {
        if (!r.finishedAt) return false;
        const reportTime = new Date(r.finishedAt).getTime();
        return now - reportTime <= threshold;
      });
    }

    setFiltered(arr);
  };
  
  const loadDailyTasks = async () => {
    try {
      const { data } = await api.get("/api/raporlar", { params: { limit: 200 } });
      const today = new Date().toLocaleDateString("tr-TR");
      const todayData = data.filter(
        (x) => x.finishedAt && new Date(x.finishedAt).toLocaleDateString("tr-TR") === today
      );

      const solved = todayData.reduce((a, r) => a + ((r.correctCount || 0) + (r.wrongCount || 0) + (r.emptyCount || 0)), 0);
      const correct = todayData.reduce((a, r) => a + (r.correctCount || 0), 0);
      const sessions = todayData.length;

      setDailyStats({ solved, correct, sessions });
      
      // Görev kontrolü
      const saved = localStorage.getItem("dailyTasks");
      let completed = { task1: false, task2: false, task3: false };
      
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedDate = parsed.date;
        if (savedDate === today) {
          completed = parsed.completed;
        }
      }
      
      // Otomatik tamamlama kontrolü
      const updated = { ...completed };
      if (solved >= 20 && !updated.task1) updated.task1 = true;
      if (correct >= 10 && !updated.task2) updated.task2 = true;
      if (sessions >= 1 && !updated.task3) updated.task3 = true;
      
      setDailyTasks(updated);
      
      if (JSON.stringify(updated) !== JSON.stringify(completed)) {
        localStorage.setItem("dailyTasks", JSON.stringify({ date: today, completed: updated }));
      }
    } catch (e) {
      console.error("Günlük görevler yüklenemedi:", e);
    }
  };
  
  const calculateProgress = () => {
    // İlerleme hesaplama: toplam çözülen soru sayısına göre
    // 1000 soru = %100 ilerleme (ayarlanabilir)
    const totalSorular = filtered.reduce((sum, r) => {
      return sum + (r.correctCount || 0) + (r.wrongCount || 0) + (r.emptyCount || 0);
    }, 0);
    const hedefSorular = 1000; // Hedef soru sayısı
    const progress = Math.min(100, Math.round((totalSorular / hedefSorular) * 100));
    setIlerlemeYuzdesi(progress || 0);
  };
  
  const handleHedefKaydet = () => {
    localStorage.setItem("userHedef", JSON.stringify(hedef));
    alert("Hedefiniz kaydedildi! 🎯");
  };
  
  const handlePuanlariKullan = () => {
    if (onNavigate) {
      onNavigate("game");
    }
  };
  
  const loadWeeklyCalendarData = () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Pazartesi
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const weekData = days.map((dayName, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + index);

      const dayReports = raporlar.filter(rapor => {
        if (!rapor.finishedAt) return false;
        const reportDate = new Date(rapor.finishedAt);
        return reportDate >= dayDate && reportDate < new Date(dayDate.getTime() + 24 * 60 * 60 * 1000);
      });

      let totalMinutes = 0;
      dayReports.forEach(rapor => {
        if (rapor.durationMs) {
          totalMinutes += Math.round(rapor.durationMs / 60000);
        } else if (rapor.items && rapor.items.length > 0) {
          const itemMinutes = rapor.items.reduce((sum, item) => sum + (item.elapsedMs || 0), 0);
          totalMinutes += Math.round(itemMinutes / 60000);
        }
      });

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return {
        dayName,
        date: dayDate,
        hours,
        minutes,
        totalMinutes,
        isToday: new Date().toDateString() === dayDate.toDateString()
      };
    });

    setWeeklyCalendarData(weekData);
  };

  const {
    lineLabels,
    lineData,
    totalDogru,
    totalYanlis,
    totalBos,
    netLabels,
    netValues,
    pieDogru,
    pieYanlis,
    pieBos,
  } = grafikVerileri;

  const getFilterLabel = () => {
    if (dateFilter === "1") return "Günlük";
    if (dateFilter === "7") return "Haftalık";
    if (dateFilter === "30") return "Aylık";
    return "Tüm Zamanlar";
  };

  return (
    <div className="dashboard-container">
      {/* Üst Bölüm: Kullanıcı Kartı ve Filtre */}
      <div className="dashboard-top-section">
        {/* Kullanıcı Kartı */}
        <div className="user-card">
          <div className="user-left">
            <div className="user-name">{me?.ad} {me?.soyad}</div>
            <div className="user-id">#{me?.id || "10044743"}</div>
            <div className="user-progress">
              Çalışma programının %{ilerlemeYuzdesi}'ini tamamladın!  
              <span className="progress-highlight"> İlerlemen Harika!</span>
            </div>
          </div>

          <div className="user-right">
            <div className="points-box">
              <div className="score">{me?.puan || 2938}</div>
              <div className="score-stars">⭐⭐</div>
              <button className="score-button" onClick={handlePuanlariKullan}>
                Puanları Kullan
              </button>
            </div>
          </div>
        </div>

        {/* Tarih Filtresi - Kompakt */}
        <div className="dashboard-filter-compact">
          <label>Tarih:</label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="dashboard-filter-select"
          >
            <option value="1">Günlük</option>
            <option value="7">Haftalık</option>
            <option value="30">Aylık</option>
            <option value="all">Tüm Zamanlar</option>
          </select>
          <span className="dashboard-filter-badge">
            {getFilterLabel()} • {filtered.length} oturum
          </span>
        </div>
      </div>

      {/* Ana Grid Layout */}
      <div className="dashboard-main-grid">
        {/* Sol Kolon */}
        <div className="dashboard-left-column">
          {/* Günlük Çalışma Performansı - Büyük Grafik */}
          <div className="dashboard-graph-card dashboard-graph-large">
            <div className="dashboard-graph-header">
              <div className="dashboard-graph-title">Günlük Çalışma Performansı</div>
              <div className="dashboard-graph-subtitle">
                {filtered.length} oturum • {totalDogru + totalYanlis + totalBos} soru
              </div>
            </div>
            <div className="dashboard-chart-container">
              {loading ? (
                <div className="dashboard-loading">Yükleniyor...</div>
              ) : lineData.length > 0 ? (
                <Line
                  data={{
                    labels: lineLabels,
                    datasets: [
                      {
                        label: "Başarı (%)",
                        data: lineData,
                        borderColor: "#667eea",
                        backgroundColor: "rgba(102,126,234,0.1)",
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        backgroundColor: "rgba(0,0,0,0.8)",
                        padding: 12,
                        cornerRadius: 8,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                          callback: function(value) {
                            return value + "%";
                          },
                        },
                      },
                    },
                  }}
                />
              ) : (
                <div className="dashboard-empty">Veri bulunamadı</div>
              )}
            </div>
          </div>

          {/* Net Puan Gelişimi */}
          <div className="dashboard-graph-card dashboard-graph-medium">
            <div className="dashboard-graph-header">
              <div className="dashboard-graph-title">Net Puan Gelişimi</div>
            </div>
            <div className="dashboard-chart-container">
              {loading ? (
                <div className="dashboard-loading">Yükleniyor...</div>
              ) : netValues.length > 0 ? (
                <Bar
                  data={{
                    labels: netLabels,
                    datasets: [
                      {
                        label: "Net",
                        data: netValues,
                        backgroundColor: "#764ba2",
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        backgroundColor: "rgba(0,0,0,0.8)",
                        padding: 12,
                        cornerRadius: 8,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              ) : (
                <div className="dashboard-empty">Veri bulunamadı</div>
              )}
            </div>
          </div>
        </div>

        {/* Sağ Kolon */}
        <div className="dashboard-right-column">
          {/* Haftalık Takvim Widget */}
          <div className="card dashboard-calendar-widget">
            <div className="card-title">
              <span>📅 Haftalık Takvim</span>
              {onNavigate && (
                <button 
                  className="calendar-view-all-btn"
                  onClick={() => onNavigate("takvim")}
                >
                  Tümünü Gör
                </button>
              )}
            </div>
            <div className="calendar-widget-grid">
              {weeklyCalendarData.map((day, index) => {
                const hours = day.hours + (day.minutes / 60);
                return (
                  <div
                    key={index}
                    className={`calendar-widget-day ${day.isToday ? "today" : ""} ${hours > 0 ? "has-activity" : ""}`}
                  >
                    <div className="calendar-widget-day-header">
                      <span className="calendar-widget-day-name">{day.dayName}</span>
                      <span className="calendar-widget-day-number">{day.date.getDate()}</span>
                    </div>
                    <div className="calendar-widget-day-content">
                      {hours > 0 ? (
                        <div className="calendar-widget-hours">
                          <span className="calendar-widget-hours-value">{day.hours}</span>
                          <span className="calendar-widget-hours-label">saat</span>
                          {day.minutes > 0 && (
                            <span className="calendar-widget-minutes">{day.minutes} dk</span>
                          )}
                        </div>
                      ) : (
                        <div className="calendar-widget-empty">-</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="calendar-widget-footer">
              <div className="calendar-widget-total">
                Toplam: <strong>{weeklyCalendarData.reduce((sum, d) => sum + d.hours + (d.minutes / 60), 0).toFixed(1)} saat</strong>
              </div>
            </div>
          </div>

          {/* Özet İstatistikler */}
          <div className="dashboard-stats-compact">
            <div className="dashboard-stat-item stat-dogru">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <div className="stat-value">{totalDogru}</div>
                <div className="stat-label">Doğru</div>
              </div>
            </div>
            <div className="dashboard-stat-item stat-yanlis">
              <div className="stat-icon">❌</div>
              <div className="stat-content">
                <div className="stat-value">{totalYanlis}</div>
                <div className="stat-label">Yanlış</div>
              </div>
            </div>
            <div className="dashboard-stat-item stat-bos">
              <div className="stat-icon">⚪</div>
              <div className="stat-content">
                <div className="stat-value">{totalBos}</div>
                <div className="stat-label">Boş</div>
              </div>
            </div>
            <div className="dashboard-stat-item stat-oturum">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">{filtered.length}</div>
                <div className="stat-label">Oturum</div>
              </div>
            </div>
          </div>

          {/* Doğru/Yanlış/Boş Dağılımı */}
          <div className="dashboard-graph-card dashboard-graph-small">
            <div className="dashboard-graph-header">
              <div className="dashboard-graph-title">Dağılım</div>
            </div>
            <div className="dashboard-chart-container">
              {loading ? (
                <div className="dashboard-loading">Yükleniyor...</div>
              ) : pieDogru + pieYanlis + pieBos > 0 ? (
                <Pie
                  data={{
                    labels: ["Doğru", "Yanlış", "Boş"],
                    datasets: [
                      {
                        data: [pieDogru, pieYanlis, pieBos],
                        backgroundColor: ["#10b981", "#ef4444", "#6b7280"],
                        borderWidth: 2,
                        borderColor: "#fff",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "bottom",
                        labels: {
                          padding: 10,
                          font: {
                            size: 12,
                          },
                        },
                      },
                      tooltip: {
                        backgroundColor: "rgba(0,0,0,0.8)",
                        padding: 12,
                        cornerRadius: 8,
                      },
                    },
                  }}
                />
              ) : (
                <div className="dashboard-empty">Veri bulunamadı</div>
              )}
            </div>
          </div>

          {/* Günlük Görevler */}
          <div className="card dashboard-daily-tasks">
            <div className="card-title">📅 Günlük Görevler</div>
            <div className="daily-tasks-list">
              <div className={`daily-task-item ${dailyTasks.task1 ? "completed" : ""}`}>
                <div className="task-content">
                  <div className="task-title">20 soru çöz</div>
                  <div className="task-progress">{dailyStats.solved}/20</div>
                </div>
                {dailyTasks.task1 ? <span className="task-check">✔</span> : <span className="task-pending">⌛</span>}
              </div>
              <div className={`daily-task-item ${dailyTasks.task2 ? "completed" : ""}`}>
                <div className="task-content">
                  <div className="task-title">10 doğru cevap</div>
                  <div className="task-progress">{dailyStats.correct}/10</div>
                </div>
                {dailyTasks.task2 ? <span className="task-check">✔</span> : <span className="task-pending">⌛</span>}
              </div>
              <div className={`daily-task-item ${dailyTasks.task3 ? "completed" : ""}`}>
                <div className="task-content">
                  <div className="task-title">1 test başlat</div>
                  <div className="task-progress">{dailyStats.sessions}/1</div>
                </div>
                {dailyTasks.task3 ? <span className="task-check">✔</span> : <span className="task-pending">⌛</span>}
              </div>
            </div>
          </div>

          {/* Hedefler */}
          <div className="card dashboard-goals">
            <div className="card-title">🎯 Hedeflerim</div>
            <div className="goals-content">
              {hedef.universite && hedef.bolum ? (
                <div className="goal-display">
                  <div className="goal-text">
                    <strong>{hedef.universite}</strong>
                    <span>{hedef.bolum}</span>
                  </div>
                  <div className="goal-net">
                    Hedef Sıralama: <strong>{hedef.siralamaHedef?.toLocaleString('tr-TR') || 'Belirtilmemiş'}</strong>
                  </div>
                  {netValues.length > 0 && (
                    <div className="goal-progress">
                      <div className="goal-progress-text">
                        En Yüksek Net: {Math.max(...netValues).toFixed(1)}
                      </div>
                      <div className="goal-progress-hint">
                        💡 Sıralama hedefinize ulaşmak için düzenli çalışmaya devam edin!
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="goal-empty">Henüz hedef belirlenmemiş</div>
              )}
              <div className="goal-form">
                <input
                  type="text"
                  placeholder="Üniversite adı"
                  value={hedef.universite}
                  onChange={(e) => setHedef({ ...hedef, universite: e.target.value })}
                  className="goal-input"
                />
                <input
                  type="text"
                  placeholder="Bölüm adı"
                  value={hedef.bolum}
                  onChange={(e) => setHedef({ ...hedef, bolum: e.target.value })}
                  className="goal-input"
                />
                <div className="goal-net-input">
                  <label>Hedef Sıralama:</label>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    value={hedef.siralamaHedef}
                    onChange={(e) => setHedef({ ...hedef, siralamaHedef: parseInt(e.target.value) || 10000 })}
                    className="goal-input-small"
                  />
                </div>
                <button className="goal-save-btn" onClick={handleHedefKaydet}>
                  Kaydet
                </button>
              </div>
            </div>
          </div>

          {/* Son Aktiviteler */}
          <div className="card dashboard-activities">
            <div className="card-title">Son Aktivitelerim</div>
            <div className="activities-list">
              {filtered.length > 0 ? (
                filtered.slice(-5).reverse().map((rapor, index) => {
                  const dogru = rapor.correctCount || 0;
                  const yanlis = rapor.wrongCount || 0;
                  const bos = rapor.emptyCount || 0;
                  const total = dogru + yanlis + bos;
                  const basari = total > 0 ? Math.round((dogru / total) * 100) : 0;
                  const tarih = rapor.finishedAt
                    ? new Date(rapor.finishedAt).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "Tarih yok";

                  return (
                    <div key={rapor.oturumId || index} className="activity-item">
                      <div className="activity-icon">📘</div>
                      <div className="activity-content">
                        <div className="activity-date">{tarih}</div>
                        <div className="activity-stats">
                          %{basari} • {dogru}✅ {yanlis}❌ {bos}⚪
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="activity-item">
                  <div className="activity-content">
                    <div className="activity-date">Henüz aktivite bulunmuyor</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
