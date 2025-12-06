// src/Takvim.jsx
import React, { useEffect, useState, useMemo } from "react";
import api from "./services/api";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import "./Takvim.css";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

export default function Takvim({ onBack }) {
  const [raporlar, setRaporlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all"); // all, video, test, soru
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  // Haftalık verileri hesapla
  const weeklyData = useMemo(() => {
    const weekStart = new Date(selectedWeek);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Pazartesi
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const weekData = days.map((dayName, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + index);

      // Bu güne ait raporları filtrele
      const dayReports = raporlar.filter(rapor => {
        if (!rapor.finishedAt) return false;
        const reportDate = new Date(rapor.finishedAt);
        return reportDate >= dayDate && reportDate < new Date(dayDate.getTime() + 24 * 60 * 60 * 1000);
      });

      // Çalışma saatlerini hesapla
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
        reports: dayReports.length,
        solved: dayReports.reduce((sum, r) => sum + (r.correctCount || 0) + (r.wrongCount || 0) + (r.emptyCount || 0), 0)
      };
    });

    return weekData;
  }, [raporlar, selectedWeek]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await api.get("/api/raporlar/grafikler", {
        params: { limit: 500 },
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
          items: rapor.items || [],
        };
      });

      setRaporlar(processedData);
    } catch (e) {
      console.error("Veri yüklenemedi:", e);
      try {
        const { data } = await api.get("/api/raporlar", { params: { limit: 500 } });
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
            items: [],
          };
        });
        setRaporlar(processedData);
      } catch (fallbackError) {
        console.error("Tüm endpoint'ler başarısız:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedWeek(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedWeek(newDate);
  };

  const goToToday = () => {
    setSelectedWeek(new Date());
  };

  const getWeekRange = () => {
    const weekStart = new Date(selectedWeek);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    return {
      start: weekStart.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }),
      end: weekEnd.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }),
    };
  };

  const chartData = {
    labels: weeklyData.map(d => d.dayName),
    datasets: [
      {
        label: "Çalışma Saati",
        data: weeklyData.map(d => {
          const hours = d.hours + (d.minutes / 60);
          return parseFloat(hours.toFixed(1));
        }),
        borderColor: "#667eea",
        backgroundColor: "rgba(102, 126, 234, 0.1)",
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const chartOptions = {
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
        callbacks: {
          label: function(context) {
            const data = weeklyData[context.dataIndex];
            return `${data.hours} saat ${data.minutes} dakika`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return value + " saat";
          },
        },
      },
    },
  };

  const weekRange = getWeekRange();
  const totalWeekHours = weeklyData.reduce((sum, d) => sum + d.hours + (d.minutes / 60), 0);

  return (
    <div className="takvim-container">
      <div className="takvim-header">
        <div className="takvim-header-left">
          <h1 className="takvim-title">Çalışma Takvimi</h1>
          <p className="takvim-subtitle">Haftalık çalışma performansınızı takip edin</p>
        </div>
        {onBack && (
          <button className="back-button" onClick={onBack}>
            ← Geri
          </button>
        )}
      </div>

      {/* Hafta Navigasyonu */}
      <div className="week-navigation">
        <button className="nav-btn" onClick={goToPreviousWeek}>
          ← Önceki Hafta
        </button>
        <div className="week-range">
          <span className="week-text">
            {weekRange.start} - {weekRange.end}
          </span>
          <button className="today-btn" onClick={goToToday}>
            Bugün
          </button>
        </div>
        <button className="nav-btn" onClick={goToNextWeek}>
          Sonraki Hafta →
        </button>
      </div>

      {/* Filtre */}
      <div className="filter-section">
        <label>Filtre:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="filter-select"
        >
          <option value="all">Tüm Aktiviteler</option>
          <option value="video">Video İzleme</option>
          <option value="test">Test Çözme</option>
          <option value="soru">Soru Çözme</option>
        </select>
        <div className="total-hours">
          Toplam: <strong>{totalWeekHours.toFixed(1)} saat</strong>
        </div>
      </div>

      {/* Haftalık Takvim */}
      <div className="calendar-grid">
        {weeklyData.map((day, index) => {
          const isToday = new Date().toDateString() === day.date.toDateString();
          const hours = day.hours + (day.minutes / 60);
          
          return (
            <div
              key={index}
              className={`calendar-day ${isToday ? "today" : ""} ${hours > 0 ? "has-activity" : ""}`}
            >
              <div className="day-header">
                <span className="day-name">{day.dayName}</span>
                <span className="day-number">{day.date.getDate()}</span>
              </div>
              <div className="day-content">
                {hours > 0 ? (
                  <>
                    <div className="day-hours">
                      <span className="hours-value">{day.hours}</span>
                      <span className="hours-label">saat</span>
                      {day.minutes > 0 && (
                        <span className="minutes-value">{day.minutes} dk</span>
                      )}
                    </div>
                    <div className="day-stats">
                      <span className="stat-item">{day.reports} oturum</span>
                      <span className="stat-item">{day.solved} soru</span>
                    </div>
                  </>
                ) : (
                  <div className="day-empty">Çalışma yok</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grafik */}
      <div className="chart-section">
        <div className="chart-header">
          <h3>Günlük Çalışma Performansı</h3>
          <div className="chart-info">
            {totalWeekHours.toFixed(1)} saat, {weeklyData.reduce((sum, d) => sum + d.reports, 0)} oturum
          </div>
        </div>
        <div className="chart-container">
          {loading ? (
            <div className="chart-loading">Yükleniyor...</div>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>
    </div>
  );
}



