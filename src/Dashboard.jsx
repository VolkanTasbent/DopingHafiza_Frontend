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
import PomodoroTimer from "./PomodoroTimer";
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

export default function Dashboard({ me, onNavigate, onSelectDers, onSelectDersDetay }) {
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
  
  // Hedefler state - Backend'den yüklenecek
  const [hedef, setHedef] = useState({
    universite: "",
    bolum: "",
    siralamaHedef: 10000
  });
  const [hedefLoading, setHedefLoading] = useState(true);
  
  // İlerleme hesaplama
  const [ilerlemeYuzdesi, setIlerlemeYuzdesi] = useState(27);
  
  // Takvim widget için haftalık veri
  const [weeklyCalendarData, setWeeklyCalendarData] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Pazartesi
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  });
  
  // Pomodoro istatistikleri
  const [pomodoroStats, setPomodoroStats] = useState({
    today: { count: 0, minutes: 0 },
    week: { count: 0, minutes: 0 },
    month: { count: 0, minutes: 0 },
    total: { count: 0, minutes: 0 }
  });
  
  // Son aktiviteler
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  
  // Bildirimler
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      icon: '🎯',
      title: 'Günlük Hedef Tamamlandı!',
      message: 'Bugün 30 soru çözdün. Harika iş!',
      time: '2 saat önce',
      read: false,
      onClick: () => onNavigate && onNavigate("tasks")
    },
    {
      id: 2,
      icon: '🏆',
      title: 'Yeni Rozet Kazandın!',
      message: 'Başlangıç Ustası rozetini kazandın.',
      time: '5 saat önce',
      read: false,
      onClick: () => onNavigate && onNavigate("badges")
    }
  ]);
  
  // Günlük çalışma süresi hesaplama
  const dailyStudyTime = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayReports = raporlar.filter(rapor => {
      if (!rapor.finishedAt) return false;
      const reportDate = new Date(rapor.finishedAt);
      return reportDate >= today;
    });
    
    let totalMinutes = 0;
    todayReports.forEach(rapor => {
      if (rapor.durationMs) {
        totalMinutes += Math.round(rapor.durationMs / 60000);
      }
    });
    
    // Pomodoro süresini ekle
    totalMinutes += pomodoroStats.today.minutes || 0;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return { hours, minutes, totalMinutes };
  }, [raporlar, pomodoroStats]);

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

    // Günlük çalışma sürelerini hesapla
    const dailyStudyTimes = new Map(); // { "2025-01-15": { totalMinutes, hours, minutes } }
    
    // Raporlardan günlük süreleri hesapla
    sortedRaporlar.forEach(rapor => {
      if (!rapor.finishedAt) return;
      
      const date = new Date(rapor.finishedAt);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD formatı
      
      let totalMinutes = 0;
      if (rapor.durationMs) {
        totalMinutes = Math.round(rapor.durationMs / 60000);
      } else if (rapor.items && rapor.items.length > 0) {
        const itemMinutes = rapor.items.reduce((sum, item) => sum + (item.elapsedMs || 0), 0);
        totalMinutes = Math.round(itemMinutes / 60000);
      }
      
      if (!dailyStudyTimes.has(dateKey)) {
        dailyStudyTimes.set(dateKey, { totalMinutes: 0, hours: 0, minutes: 0 });
      }
      
      const dayData = dailyStudyTimes.get(dateKey);
      dayData.totalMinutes += totalMinutes;
      dayData.hours = Math.floor(dayData.totalMinutes / 60);
      dayData.minutes = dayData.totalMinutes % 60;
    });
    
    // Pomodoro sürelerini ekle (localStorage'dan geçmiş günler için)
    let localPomodoroStats = {};
    try {
      const userId = me?.id || "guest";
      const pomodoroStatsKey = `pomodoroStats_${userId}`;
      localPomodoroStats = JSON.parse(localStorage.getItem(pomodoroStatsKey) || localStorage.getItem("pomodoroStats") || "{}");
      
      Object.keys(localPomodoroStats).forEach(dateKey => {
        const dayStats = localPomodoroStats[dateKey];
        if (dayStats && dayStats.minutes > 0) {
          if (!dailyStudyTimes.has(dateKey)) {
            dailyStudyTimes.set(dateKey, { totalMinutes: 0, hours: 0, minutes: 0 });
          }
          const dayData = dailyStudyTimes.get(dateKey);
          dayData.totalMinutes += dayStats.minutes || 0;
          dayData.hours = Math.floor(dayData.totalMinutes / 60);
          dayData.minutes = dayData.totalMinutes % 60;
        }
      });
    } catch (e) {
      console.error("Pomodoro verileri yüklenemedi:", e);
    }
    
    // Bugünkü pomodoro verisini de ekle (eğer henüz eklenmediyse)
    const today = new Date().toISOString().split('T')[0];
    if (pomodoroStats.today && pomodoroStats.today.minutes > 0) {
      if (!dailyStudyTimes.has(today)) {
        dailyStudyTimes.set(today, { totalMinutes: 0, hours: 0, minutes: 0 });
      }
      const todayData = dailyStudyTimes.get(today);
      // Eğer bugünkü veri zaten localStorage'dan eklenmediyse ekle
      if (!localPomodoroStats[today]) {
        todayData.totalMinutes += pomodoroStats.today.minutes || 0;
        todayData.hours = Math.floor(todayData.totalMinutes / 60);
        todayData.minutes = todayData.totalMinutes % 60;
      }
    }
    
    // Son 10 günü al ve sırala
    const sortedDays = Array.from(dailyStudyTimes.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10);
    
    // Son 10 Gün Çalışma Süresi
    const lineLabels = sortedDays.map(([dateKey]) => {
      const date = new Date(dateKey);
      return date.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
      });
    });

    const lineData = sortedDays.map(([dateKey, dayData]) => {
      // Saat cinsinden göster (ondalıklı)
      return parseFloat((dayData.totalMinutes / 60).toFixed(2));
    });

    // Toplam Doğru/Yanlış/Boş
    const totalDogru = sortedRaporlar.reduce((t, x) => t + (x.correctCount || 0), 0);
    const totalYanlis = sortedRaporlar.reduce((t, x) => t + (x.wrongCount || 0), 0);
    const totalBos = sortedRaporlar.reduce((t, x) => t + (x.emptyCount || 0), 0);

    // Net Gelişimi (son 10 rapor için)
    const last10Raporlar = sortedRaporlar.slice(-10);
    const netValues = last10Raporlar.map((x) => {
      const dogru = x.correctCount || 0;
      const yanlis = x.wrongCount || 0;
      return parseFloat((dogru - yanlis / 4).toFixed(2));
    });
    
    // Net grafiği için label'lar (son 10 raporun tarihleri)
    const netLabels = last10Raporlar.map((x, index) => {
      if (x.finishedAt) {
        return new Date(x.finishedAt).toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
        });
      }
      return `Oturum ${index + 1}`;
    });

    const hasItems = filtered.some((rapor) => rapor.items && rapor.items.length > 0);

      return {
        lineLabels,
        lineData,
        totalDogru,
        totalYanlis,
        totalBos,
        netLabels,
        netValues,
      pieDogru: totalDogru,
      pieYanlis: totalYanlis,
      pieBos: totalBos,
      hasItems,
    };
  }, [filtered, pomodoroStats, me?.id]);

  useEffect(() => {
    loadData();
    loadDailyTasks();
    calculateProgress();
    loadWeeklyCalendarData();
    loadPomodoroStats();
    loadUserHedef();
    loadRecentActivities();
    
    // Pomodoro timer'dan gelen yenileme isteklerini dinle
    const handlePomodoroRefresh = () => {
      loadPomodoroStats();
    };
    window.addEventListener('pomodoroCompleted', handlePomodoroRefresh);
    
    return () => {
      window.removeEventListener('pomodoroCompleted', handlePomodoroRefresh);
    };
  }, [me]);
  
  useEffect(() => {
    loadWeeklyCalendarData();
  }, [raporlar, pomodoroStats, currentWeekStart]);

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
  
  const loadUserHedef = async () => {
    if (!me?.id) {
      setHedefLoading(false);
      return;
    }
    
    try {
      const { data } = await api.get("/api/users/me");
      // Backend'den hedef bilgilerini al
      setHedef({
        universite: data.hedefUniversite || data.hedef_universite || "",
        bolum: data.hedefBolum || data.hedef_bolum || "",
        siralamaHedef: data.hedefSiralama || data.hedef_siralama || data.siralamaHedef || 10000
      });
      
      // Fallback: Eğer backend'de yoksa localStorage'dan yükle (geçici)
      if (!data.hedefUniversite && !data.hedef_universite) {
        const saved = localStorage.getItem(`userHedef_${me.id}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setHedef({
              universite: parsed.universite || "",
              bolum: parsed.bolum || "",
              siralamaHedef: parsed.siralamaHedef || 10000
            });
          } catch (e) {
            console.error("LocalStorage parse hatası:", e);
          }
        }
      }
    } catch (error) {
      console.error("Hedef bilgileri yüklenemedi:", error);
      // Fallback: localStorage'dan yükle
      const saved = localStorage.getItem(`userHedef_${me.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setHedef({
            universite: parsed.universite || "",
            bolum: parsed.bolum || "",
            siralamaHedef: parsed.siralamaHedef || 10000
          });
        } catch (e) {
          console.error("LocalStorage parse hatası:", e);
        }
      }
    } finally {
      setHedefLoading(false);
    }
  };

  const handleHedefKaydet = async () => {
    if (!me?.id) {
      alert("Giriş yapmanız gerekiyor!");
      return;
    }
    
    try {
      // Backend'e kaydet
      await api.put("/api/users/me", {
        hedefUniversite: hedef.universite,
        hedefBolum: hedef.bolum,
        hedefSiralama: hedef.siralamaHedef
      });
      
      // LocalStorage'a da kaydet (fallback için)
      localStorage.setItem(`userHedef_${me.id}`, JSON.stringify(hedef));
      
      alert("Hedefiniz kaydedildi! 🎯");
    } catch (error) {
      console.error("Hedef kaydedilemedi:", error);
      // Fallback: Sadece localStorage'a kaydet
      localStorage.setItem(`userHedef_${me.id}`, JSON.stringify(hedef));
      alert("Hedefiniz geçici olarak kaydedildi (backend bağlantısı yok).");
    }
  };
  
  const handlePuanlariKullan = () => {
    if (onNavigate) {
      onNavigate("game");
    }
  };
  
  const loadPomodoroStats = async () => {
    try {
      const response = await api.get("/api/pomodoro/stats");
      if (response.data) {
        setPomodoroStats(response.data);
      }
    } catch (error) {
      console.error("Pomodoro istatistikleri yüklenemedi:", error);
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
      
      setPomodoroStats({
        today: todayStats,
        week: weekStats,
        month: { count: Object.values(localStats).reduce((sum, s) => sum + (s.count || 0), 0), minutes: Object.values(localStats).reduce((sum, s) => sum + (s.minutes || 0), 0) },
        total: { count: Object.values(localStats).reduce((sum, s) => sum + (s.count || 0), 0), minutes: Object.values(localStats).reduce((sum, s) => sum + (s.minutes || 0), 0) }
      });
    }
  };

  const loadWeeklyCalendarData = () => {
    const today = new Date();
    const weekStart = new Date(currentWeekStart);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const weekData = days.map((dayName, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + index);
      const dayDateStr = dayDate.toISOString().split("T")[0];
      const todayStr = new Date().toISOString().split("T")[0];

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

      // Pomodoro süresini ekle (sadece bugün için)
      if (dayDateStr === todayStr) {
        totalMinutes += pomodoroStats.today.minutes || 0;
      }

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

  const handleWeekNavigation = (direction) => {
    const newWeekStart = new Date(currentWeekStart);
    if (direction === 'prev') {
      newWeekStart.setDate(newWeekStart.getDate() - 7);
    } else {
      newWeekStart.setDate(newWeekStart.getDate() + 7);
    }
    setCurrentWeekStart(newWeekStart);
  };
  
  const loadRecentActivities = async () => {
    if (!me?.id) {
      setActivitiesLoading(false);
      return;
    }
    
    try {
      const { data } = await api.get("/api/activities/recent", {
        params: { limit: 20 }
      });
      
      if (data?.activities) {
        // Backend'den gelen aktiviteler zaten DESC sıralı olmalı (en yeni en üstte)
        setRecentActivities(data.activities);
      } else {
        // Fallback: Raporlardan ve localStorage'dan aktivite oluştur
        const allActivities = [];
        
        // 1. Raporlardan soru çözme aktiviteleri
        const sortedRaporlar = [...raporlar].sort((a, b) => {
          const dateA = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
          const dateB = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
          return dateB - dateA; // DESC sıralama (en yeni en üstte)
        });
        
        sortedRaporlar.forEach(rapor => {
          if (rapor.finishedAt) {
            // Ders ve konu bilgilerini items'dan al
            let dersAd = "Soru Çözme";
            let konuAd = "";
            let dersId = null;
            let konuId = null;
            
            if (rapor.items && rapor.items.length > 0) {
              // İlk sorudan ders bilgisini al
              const firstItem = rapor.items[0];
              if (firstItem.soru) {
                dersAd = firstItem.soru.dersAd || firstItem.soru.ders?.ad || "Soru Çözme";
                dersId = firstItem.soru.dersId || firstItem.soru.ders?.id || null;
                
                // Konu bilgisini al (varsa)
                if (firstItem.soru.konular && firstItem.soru.konular.length > 0) {
                  konuAd = firstItem.soru.konular[0].ad || "";
                  konuId = firstItem.soru.konular[0].id || null;
                }
              }
            }
            
            const activityTitle = konuAd 
              ? `${dersAd} > ${konuAd}`
              : dersAd;
            
            allActivities.push({
              id: rapor.oturumId,
              activityType: "soru_cozme",
              activityTitle: activityTitle,
              activitySubtitle: `${rapor.correctCount || 0} doğru, ${rapor.wrongCount || 0} yanlış`,
              activityIcon: "abc",
              dersId: dersId,
              konuId: konuId,
              raporId: rapor.oturumId,
              createdAt: rapor.finishedAt
            });
          }
        });
        
        // 2. localStorage'dan video aktiviteleri (kullanıcıya özel)
        try {
          const userId = me?.id || "guest";
          const storageKey = `videoActivities_${userId}`;
          const savedVideoActivities = JSON.parse(localStorage.getItem(storageKey) || "[]");
          savedVideoActivities.forEach(activity => {
            allActivities.push({
              id: activity.id,
              activityType: activity.activityType || "video_izleme",
              activityTitle: activity.activityTitle || "Video İzleme",
              activitySubtitle: activity.activitySubtitle || "",
              activityIcon: activity.activityIcon || "video",
              dersId: activity.dersId,
              konuId: activity.konuId,
              createdAt: activity.createdAt || new Date().toISOString()
            });
          });
        } catch (e) {
          console.error("localStorage video aktiviteleri okunamadı:", e);
        }
        
        // 3. localStorage'dan PDF aktiviteleri (kullanıcıya özel)
        try {
          const userId = me?.id || "guest";
          const storageKey = `pdfActivities_${userId}`;
          const savedPdfActivities = JSON.parse(localStorage.getItem(storageKey) || "[]");
          savedPdfActivities.forEach(activity => {
            allActivities.push({
              id: activity.id,
              activityType: activity.activityType || "konu_calisma",
              activityTitle: activity.activityTitle || "Konu Çalışması",
              activitySubtitle: activity.activitySubtitle || "",
              activityIcon: activity.activityIcon || "book",
              dersId: activity.dersId,
              konuId: activity.konuId,
              createdAt: activity.createdAt || new Date().toISOString()
            });
          });
        } catch (e) {
          console.error("localStorage PDF aktiviteleri okunamadı:", e);
        }
        
        // 4. localStorage'dan quiz aktiviteleri (soru çözme - kullanıcıya özel)
        try {
          const userId = me?.id || "guest";
          const storageKey = `quizActivities_${userId}`;
          const savedQuizActivities = JSON.parse(localStorage.getItem(storageKey) || "[]");
          savedQuizActivities.forEach(activity => {
            allActivities.push({
              id: activity.id,
              activityType: activity.activityType || "soru_cozme",
              activityTitle: activity.activityTitle || "Soru Çözme",
              activitySubtitle: activity.activitySubtitle || "",
              activityIcon: activity.activityIcon || "abc",
              dersId: activity.dersId,
              konuId: activity.konuId,
              raporId: activity.raporId,
              createdAt: activity.createdAt || new Date().toISOString()
            });
          });
        } catch (e) {
          console.error("localStorage quiz aktiviteleri okunamadı:", e);
        }
        
        // Tüm aktiviteleri tarihe göre sırala (en yeni en üstte)
        allActivities.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        
        // İlk 20 aktiviteyi al
        setRecentActivities(allActivities.slice(0, 20));
      }
    } catch (error) {
      console.error("Aktiviteler yüklenemedi:", error);
      // Fallback: Raporlardan ve localStorage'dan aktivite oluştur
      const allActivities = [];
      
      // 1. Raporlardan soru çözme aktiviteleri
      const sortedRaporlar = [...raporlar].sort((a, b) => {
        const dateA = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
        const dateB = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
        return dateB - dateA;
      });
      
      sortedRaporlar.forEach(rapor => {
        if (rapor.finishedAt) {
          // Ders ve konu bilgilerini items'dan al
          let dersAd = "Soru Çözme";
          let konuAd = "";
          let dersId = null;
          let konuId = null;
          
          if (rapor.items && rapor.items.length > 0) {
            // İlk sorudan ders bilgisini al
            const firstItem = rapor.items[0];
            if (firstItem.soru) {
              dersAd = firstItem.soru.dersAd || firstItem.soru.ders?.ad || "Soru Çözme";
              dersId = firstItem.soru.dersId || firstItem.soru.ders?.id || null;
              
              // Konu bilgisini al (varsa)
              if (firstItem.soru.konular && firstItem.soru.konular.length > 0) {
                konuAd = firstItem.soru.konular[0].ad || "";
                konuId = firstItem.soru.konular[0].id || null;
              }
            }
          }
          
          const activityTitle = konuAd 
            ? `${dersAd} > ${konuAd}`
            : dersAd;
          
          allActivities.push({
            id: rapor.oturumId,
            activityType: "soru_cozme",
            activityTitle: activityTitle,
            activitySubtitle: `${rapor.correctCount || 0} doğru, ${rapor.wrongCount || 0} yanlış`,
            activityIcon: "abc",
            dersId: dersId,
            konuId: konuId,
            raporId: rapor.oturumId,
            createdAt: rapor.finishedAt
          });
        }
      });
      
      // 2. localStorage'dan video aktiviteleri (kullanıcıya özel)
      try {
        const userId = me?.id || "guest";
        const storageKey = `videoActivities_${userId}`;
        const savedVideoActivities = JSON.parse(localStorage.getItem(storageKey) || "[]");
        savedVideoActivities.forEach(activity => {
          allActivities.push({
            id: activity.id,
            activityType: activity.activityType || "video_izleme",
            activityTitle: activity.activityTitle || "Video İzleme",
            activitySubtitle: activity.activitySubtitle || "",
            activityIcon: activity.activityIcon || "video",
            dersId: activity.dersId,
            konuId: activity.konuId,
            createdAt: activity.createdAt || new Date().toISOString()
          });
        });
      } catch (e) {
        console.error("localStorage video aktiviteleri okunamadı:", e);
      }
      
      // 3. localStorage'dan PDF aktiviteleri (kullanıcıya özel)
      try {
        const userId = me?.id || "guest";
        const storageKey = `pdfActivities_${userId}`;
        const savedPdfActivities = JSON.parse(localStorage.getItem(storageKey) || "[]");
        savedPdfActivities.forEach(activity => {
          allActivities.push({
            id: activity.id,
            activityType: activity.activityType || "konu_calisma",
            activityTitle: activity.activityTitle || "Konu Çalışması",
            activitySubtitle: activity.activitySubtitle || "",
            activityIcon: activity.activityIcon || "book",
            dersId: activity.dersId,
            konuId: activity.konuId,
            createdAt: activity.createdAt || new Date().toISOString()
          });
        });
      } catch (e) {
        console.error("localStorage PDF aktiviteleri okunamadı:", e);
      }
      
      // 4. localStorage'dan quiz aktiviteleri (soru çözme - kullanıcıya özel)
      try {
        const userId = me?.id || "guest";
        const storageKey = `quizActivities_${userId}`;
        const savedQuizActivities = JSON.parse(localStorage.getItem(storageKey) || "[]");
        savedQuizActivities.forEach(activity => {
          allActivities.push({
            id: activity.id,
            activityType: activity.activityType || "soru_cozme",
            activityTitle: activity.activityTitle || "Soru Çözme",
            activitySubtitle: activity.activitySubtitle || "",
            activityIcon: activity.activityIcon || "abc",
            dersId: activity.dersId,
            konuId: activity.konuId,
            raporId: activity.raporId,
            createdAt: activity.createdAt || new Date().toISOString()
          });
        });
      } catch (e) {
        console.error("localStorage quiz aktiviteleri okunamadı:", e);
      }
      
      // Tüm aktiviteleri tarihe göre sırala
      allActivities.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      setRecentActivities(allActivities.slice(0, 20));
    } finally {
      setActivitiesLoading(false);
    }
  };
  
  useEffect(() => {
    if (raporlar.length > 0 && recentActivities.length === 0 && !activitiesLoading) {
      loadRecentActivities();
    }
  }, [raporlar]);
  
  // Sayfa görünür olduğunda aktiviteleri yenile (visibility API)
  useEffect(() => {
    if (!me?.id) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Sayfa görünür olduğunda aktiviteleri yenile
        loadRecentActivities();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [me?.id]);
  
  const getActivityIcon = (iconType) => {
    const icons = {
      'abc': '🔤',
      'document': '📄',
      'grid': '📊',
      'video': '▶️',
      'book': '📖'
    };
    return icons[iconType] || icons['document'];
  };
  
  const formatActivityTime = (dateString) => {
    if (!dateString) return "Az önce";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Az önce";
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  };

  const handleDayClick = (dayDate) => {
    // Günün detaylarını göster veya filtrele
    const dayStr = dayDate.toISOString().split('T')[0];
    console.log('Gün seçildi:', dayStr);
    // İsteğe bağlı: Filtreleme veya detay sayfasına yönlendirme
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
      {/* Üst Bölüm: Kullanıcı Kartı, Puan ve Takvim */}
      <div className="dashboard-top-cards">
      {/* Kullanıcı Kartı */}
        <div className="user-card-modern">
          <div className="user-card-content">
            <div className="user-info-section">
              <div className="user-name-modern">{me?.ad} {me?.soyad}</div>
              <div className="user-id-modern">#{me?.id || "10044743"}</div>
              <div className="user-progress-modern">
                Çalışma programının <strong>%{ilerlemeYuzdesi}</strong>'ini tamamladın!
                <span className="progress-status"> İlerlemen Harika! 🎉</span>
              </div>
            </div>
            <div className="user-avatar-section">
              <div className="user-avatar-large">
                {me?.avatar_url ? (
                  <img src={me.avatar_url} alt="avatar" />
                ) : (
                  <span>{me?.ad?.charAt(0) || "U"}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Puan Kutusu */}
        <div className="points-box-modern">
          <div className="points-content">
            <div className="points-value">{me?.puan || 2938}</div>
            <div className="points-stars">⭐⭐⭐</div>
            <button className="points-button" onClick={handlePuanlariKullan}>
              Puanları Kullan
            </button>
          </div>
        </div>

        {/* Haftalık Takvim Widget */}
        <div className="calendar-widget-modern">
          <div className="calendar-header-modern">
            <button 
              className="calendar-nav-btn" 
              onClick={() => handleWeekNavigation('prev')}
              type="button"
            >
              ←
            </button>
            <span className="calendar-week-label">
              {currentWeekStart.getDate()} {currentWeekStart.toLocaleDateString('tr-TR', { month: 'short' })} - 
              {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).getDate()} {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR', { month: 'short' })}
            </span>
            <button 
              className="calendar-nav-btn" 
              onClick={() => handleWeekNavigation('next')}
              type="button"
            >
              →
            </button>
          </div>
          <div className="calendar-days-modern">
            {weeklyCalendarData.map((day, index) => (
              <div
                key={index}
                className={`calendar-day-modern ${day.isToday ? "today" : ""} ${day.hours > 0 ? "has-activity" : ""}`}
                onClick={() => handleDayClick(day.date)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDayClick(day.date);
                  }
                }}
              >
                <div className="calendar-day-name">{day.dayName}</div>
                <div className="calendar-day-number">{day.date.getDate()}</div>
                {day.hours > 0 && (
                  <div className="calendar-day-hours">{day.hours}s</div>
                )}
              </div>
            ))}
          </div>
          <div className="calendar-footer-modern">
            <span>Bugün</span>
            <strong>{dailyStudyTime.hours} saat, {dailyStudyTime.minutes} dakika</strong>
          </div>
        </div>
      </div>

      {/* Günlük Çalışma Performansı - Büyük Grafik */}
      <div className="daily-performance-section">
        <div className="performance-header">
          <div className="performance-title-section">
            <h2 className="performance-title">Günlük Çalışma Performansı</h2>
            <div className="performance-time">
              {dailyStudyTime.hours} saat, {dailyStudyTime.minutes} dakika
            </div>
          </div>
          <div className="performance-actions">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="performance-filter"
            >
              <option value="1">Günlük</option>
              <option value="7">Haftalık</option>
              <option value="30">Aylık</option>
              <option value="all">Tüm Zamanlar</option>
            </select>
          </div>
        </div>
        <div className="performance-chart-container">
          {loading ? (
            <div className="dashboard-loading">Yükleniyor...</div>
          ) : lineData.length > 0 ? (
            <Line
              data={{
                labels: lineLabels,
                datasets: [
                  {
                    label: "Çalışma Süresi (saat)",
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
                    callbacks: {
                      label: function(context) {
                        const hours = Math.floor(context.parsed.y);
                        const minutes = Math.round((context.parsed.y - hours) * 60);
                        if (minutes > 0) {
                          return `${hours} saat ${minutes} dakika`;
                        }
                        return `${hours} saat`;
                      }
                    }
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return value + "s";
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

      {/* Alt Bölüm: Organize Grid Yapısı */}
      <div className="dashboard-bottom-section">
        {/* Sol Kolon: Grafikler ve Hedefler */}
        <div className="dashboard-bottom-left">
          {/* Son Aktivitelerim */}
          <div className="dashboard-card-modern">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">📋 Son Aktivitelerim</h3>
            </div>
            <div className="dashboard-card-content">
              {activitiesLoading ? (
                <div className="dashboard-loading">Yükleniyor...</div>
              ) : recentActivities.length > 0 ? (
                <div className="activities-list-modern">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="activity-item-modern">
                      <div className="activity-icon-modern">
                        {getActivityIcon(activity.activityIcon || activity.activityType)}
                      </div>
                      <div className="activity-content-modern">
                        <div className="activity-title-modern">
                          {activity.activityTitle || "Aktivite"}
                        </div>
                        {activity.activitySubtitle && (
                          <div className="activity-subtitle-modern">
                            {activity.activitySubtitle}
                          </div>
                        )}
                        <div className="activity-time-modern">
                          {formatActivityTime(activity.createdAt)}
                        </div>
                      </div>
                      <div className="activity-action-modern">
                        {(activity.activityType === "video_izleme" || activity.activityType === "soru_cozme" || activity.activityType === "konu_calisma") && (
                          <button 
                            className="activity-play-btn"
                            onClick={async () => {
                              if (activity.activityType === "soru_cozme") {
                                // Soru çözme sayfasına git
                                if (activity.dersId && onSelectDers) {
                                  try {
                                    // Ders bilgilerini al
                                    const { data: dersler } = await api.get("/api/ders");
                                    const ders = dersler?.find(d => d.id === activity.dersId);
                                    if (ders) {
                                      onSelectDers({ id: ders.id, ad: ders.ad });
                                    } else {
                                      // Ders bulunamazsa sadece ID ile git
                                      onSelectDers({ id: activity.dersId, ad: activity.activityTitle?.split(' > ')[0] || "Ders" });
                                    }
                                  } catch (error) {
                                    console.error("Ders bilgisi alınamadı:", error);
                                    // Hata durumunda da git
                                    if (activity.dersId) {
                                      onSelectDers({ id: activity.dersId, ad: activity.activityTitle?.split(' > ')[0] || "Ders" });
                                    } else if (onNavigate) {
                                      onNavigate("coz");
                                    }
                                  }
                                } else if (onNavigate) {
                                  onNavigate("coz");
                                }
                              } else if (activity.activityType === "video_izleme") {
                                // Video izleme sayfasına git (ders detay sayfası)
                                if (activity.dersId && onSelectDersDetay) {
                                  try {
                                    // Ders bilgilerini al
                                    const { data: dersler } = await api.get("/api/ders");
                                    const ders = dersler?.find(d => d.id === activity.dersId);
                                    if (ders) {
                                      // Video aktivitesi için video tab'ını aç ve konuId varsa scroll et
                                      const dersWithVideoTab = { ...ders, _initialTab: "videolar", _scrollToKonuId: activity.konuId };
                                      onSelectDersDetay(dersWithVideoTab);
                                    } else {
                                      // Ders bulunamazsa sadece ID ile git
                                      onSelectDersDetay({ 
                                        id: activity.dersId, 
                                        ad: activity.activityTitle?.split(' > ')[0] || "Ders",
                                        _initialTab: "videolar",
                                        _scrollToKonuId: activity.konuId
                                      });
                                    }
                                  } catch (error) {
                                    console.error("Ders bilgisi alınamadı:", error);
                                    // Hata durumunda da git
                                    if (activity.dersId) {
                                      onSelectDersDetay({ 
                                        id: activity.dersId, 
                                        ad: activity.activityTitle?.split(' > ')[0] || "Ders",
                                        _initialTab: "videolar",
                                        _scrollToKonuId: activity.konuId
                                      });
                                    } else if (onNavigate) {
                                      onNavigate("dersler");
                                    }
                                  }
                                } else if (onNavigate) {
                                  onNavigate("dersler");
                                }
                              } else if (activity.activityType === "konu_calisma") {
                                // Konu çalışma (PDF) sayfasına git (ders detay sayfası)
                                if (activity.dersId && onSelectDersDetay) {
                                  try {
                                    // Ders bilgilerini al
                                    const { data: dersler } = await api.get("/api/ders");
                                    const ders = dersler?.find(d => d.id === activity.dersId);
                                    if (ders) {
                                      // PDF aktivitesi için konular tab'ını aç ve konuId varsa scroll et
                                      const dersWithKonuTab = { ...ders, _initialTab: "konular", _scrollToKonuId: activity.konuId };
                                      onSelectDersDetay(dersWithKonuTab);
                                    } else {
                                      // Ders bulunamazsa sadece ID ile git
                                      onSelectDersDetay({ 
                                        id: activity.dersId, 
                                        ad: activity.activityTitle?.split(' > ')[0] || "Ders",
                                        _initialTab: "konular",
                                        _scrollToKonuId: activity.konuId
                                      });
                                    }
                                  } catch (error) {
                                    console.error("Ders bilgisi alınamadı:", error);
                                    // Hata durumunda da git
                                    if (activity.dersId) {
                                      onSelectDersDetay({ 
                                        id: activity.dersId, 
                                        ad: activity.activityTitle?.split(' > ')[0] || "Ders",
                                        _initialTab: "konular",
                                        _scrollToKonuId: activity.konuId
                                      });
                                    } else if (onNavigate) {
                                      onNavigate("dersler");
                                    }
                                  }
                                } else if (onNavigate) {
                                  onNavigate("dersler");
                                }
                              }
                            }}
                            title="Tekrar İzle/Çöz"
                          >
                            ▶
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">Henüz aktivite yok</div>
              )}
            </div>
          </div>
          {/* Net Puan Gelişimi */}
          <div className="dashboard-card-modern">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">📈 Net Puan Gelişimi</h3>
            </div>
            <div className="dashboard-card-content">
              <div className="chart-wrapper">
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
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: "rgba(0,0,0,0.8)",
                          padding: 12,
                          cornerRadius: 8,
                        },
                      },
                      scales: {
                        y: { beginAtZero: true },
                      },
                    }}
                  />
                ) : (
                  <div className="dashboard-empty">Veri bulunamadı</div>
                )}
              </div>
            </div>
          </div>

          {/* Hedeflerim */}
          <div className="dashboard-card-modern">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">🎯 Hedeflerim</h3>
            </div>
            <div className="dashboard-card-content">
              {hedef.universite && hedef.bolum ? (
                <div className="goal-display-modern">
                  <div className="goal-university">{hedef.universite}</div>
                  <div className="goal-department">{hedef.bolum}</div>
                  <div className="goal-rank-info">
                    Hedef Sıralama: <span className="goal-rank-value">{hedef.siralamaHedef?.toLocaleString('tr-TR') || 'Belirtilmemiş'}</span>
                  </div>
                  {netValues.length > 0 && (
                    <div className="goal-stats">
                      <div className="goal-stat-item">
                        <span className="goal-stat-label">En Yüksek Net</span>
                        <span className="goal-stat-value">{Math.max(...netValues).toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="goal-empty-modern">
                  <p>Henüz hedef belirlenmemiş</p>
                  <p className="goal-empty-hint">Hedef belirleyerek motivasyonunuzu artırın!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sağ Kolon: Widget'lar ve İstatistikler */}
        <div className="dashboard-bottom-right">
          {/* Özet İstatistikler ve Dağılım - Birleştirilmiş */}
          <div className="dashboard-card-modern">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">📊 İstatistikler ve Dağılım</h3>
            </div>
            <div className="dashboard-card-content">
              {/* İstatistikler */}
              <div className="stats-grid-modern">
                <div className="stat-card-modern stat-success">
                  <div className="stat-icon-modern">✅</div>
                  <div className="stat-info-modern">
                    <div className="stat-value-modern">{totalDogru}</div>
                    <div className="stat-label-modern">Doğru</div>
                  </div>
                </div>
                <div className="stat-card-modern stat-error">
                  <div className="stat-icon-modern">❌</div>
                  <div className="stat-info-modern">
                    <div className="stat-value-modern">{totalYanlis}</div>
                    <div className="stat-label-modern">Yanlış</div>
                  </div>
                </div>
                <div className="stat-card-modern stat-neutral">
                  <div className="stat-icon-modern">⚪</div>
                  <div className="stat-info-modern">
                    <div className="stat-value-modern">{totalBos}</div>
                    <div className="stat-label-modern">Boş</div>
                  </div>
                </div>
                <div className="stat-card-modern stat-info">
                  <div className="stat-icon-modern">📊</div>
                  <div className="stat-info-modern">
                    <div className="stat-value-modern">{filtered.length}</div>
                    <div className="stat-label-modern">Oturum</div>
                  </div>
                </div>
              </div>
              
              {/* Dağılım Grafiği */}
              <div className="distribution-chart-section">
                <div className="chart-wrapper-small">
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
                              font: { size: 12 },
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
            </div>
          </div>

          {/* Pomodoro Timer Widget */}
          <PomodoroTimer isWidget={true} onNavigate={onNavigate} me={me} />

          {/* Günlük Görevler */}
          <div className="dashboard-card-modern">
            <div className="dashboard-card-header">
              <h3 className="dashboard-card-title">📅 Günlük Görevler</h3>
            </div>
            <div className="dashboard-card-content">
              <div className="tasks-list-modern">
                <div className={`task-item-modern ${dailyTasks.task1 ? "completed" : ""}`}>
                  <div className="task-icon-modern">{dailyTasks.task1 ? "✅" : "⏳"}</div>
                  <div className="task-info-modern">
                    <div className="task-name-modern">20 soru çöz</div>
                    <div className="task-progress-modern">{dailyStats.solved}/20</div>
                  </div>
                </div>
                <div className={`task-item-modern ${dailyTasks.task2 ? "completed" : ""}`}>
                  <div className="task-icon-modern">{dailyTasks.task2 ? "✅" : "⏳"}</div>
                  <div className="task-info-modern">
                    <div className="task-name-modern">10 doğru cevap</div>
                    <div className="task-progress-modern">{dailyStats.correct}/10</div>
                  </div>
                </div>
                <div className={`task-item-modern ${dailyTasks.task3 ? "completed" : ""}`}>
                  <div className="task-icon-modern">{dailyTasks.task3 ? "✅" : "⏳"}</div>
                  <div className="task-info-modern">
                    <div className="task-name-modern">1 test başlat</div>
                    <div className="task-progress-modern">{dailyStats.sessions}/1</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
