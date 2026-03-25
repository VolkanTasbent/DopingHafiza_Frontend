# 🍅 Pomodoro Günlük İstatistikler - Backend Endpoint Rehberi

## 📋 Özet

Takvim sayfasında pomodoro sürelerini göstermek için backend'de günlük pomodoro istatistiklerini döndüren bir endpoint gereklidir.

---

## 🔌 API Endpoint

### Günlük Pomodoro İstatistikleri Getir

**Endpoint:** `GET /api/pomodoro/daily-stats`

**Query Parameters:**
- `startDate` (string, required): Başlangıç tarihi (YYYY-MM-DD formatında)
- `endDate` (string, required): Bitiş tarihi (YYYY-MM-DD formatında)

**Response:**
```json
{
  "dailyStats": [
    {
      "date": "2025-01-15",
      "count": 4,
      "minutes": 100
    },
    {
      "date": "2025-01-16",
      "count": 2,
      "minutes": 50
    }
  ]
}
```

---

## 🟢 Java Spring Boot Örneği

```java
@GetMapping("/api/pomodoro/daily-stats")
public ResponseEntity<DailyPomodoroStatsResponse> getDailyStats(
    @RequestParam String startDate,
    @RequestParam String endDate,
    Authentication authentication
) {
    User user = (User) authentication.getPrincipal();
    
    LocalDate start = LocalDate.parse(startDate);
    LocalDate end = LocalDate.parse(endDate);
    
    // Pomodoro session'larını tarih aralığına göre getir
    List<PomodoroSession> sessions = pomodoroSessionRepository.findByUserIdAndDateRange(
        user.getId(),
        start.atStartOfDay(),
        end.atTime(23, 59, 59)
    );
    
    // Günlük istatistikleri hesapla
    Map<String, DailyStat> dailyStatsMap = new HashMap<>();
    
    // Tüm günleri başlat (0 ile)
    LocalDate currentDate = start;
    while (!currentDate.isAfter(end)) {
        String dateKey = currentDate.toString();
        dailyStatsMap.put(dateKey, new DailyStat(dateKey, 0, 0));
        currentDate = currentDate.plusDays(1);
    }
    
    // Session'ları günlere göre grupla
    for (PomodoroSession session : sessions) {
        String dateKey = session.getCompletedAt().toLocalDate().toString();
        DailyStat stat = dailyStatsMap.get(dateKey);
        if (stat != null) {
            stat.setCount(stat.getCount() + 1);
            stat.setMinutes(stat.getMinutes() + session.getDuration());
        }
    }
    
    List<DailyStat> dailyStats = new ArrayList<>(dailyStatsMap.values());
    dailyStats.sort(Comparator.comparing(DailyStat::getDate));
    
    return ResponseEntity.ok(new DailyPomodoroStatsResponse(dailyStats));
}

// DTO
public class DailyStat {
    private String date;
    private int count;
    private int minutes;
    
    // Constructors, getters, setters
}

public class DailyPomodoroStatsResponse {
    private List<DailyStat> dailyStats;
    
    // Constructors, getters, setters
}

// Repository Method
@Query("SELECT p FROM PomodoroSession p WHERE p.userId = :userId " +
       "AND p.completedAt >= :startDate AND p.completedAt <= :endDate")
List<PomodoroSession> findByUserIdAndDateRange(
    @Param("userId") Long userId,
    @Param("startDate") LocalDateTime startDate,
    @Param("endDate") LocalDateTime endDate
);
```

---

## 🐍 Python/Flask Örneği

```python
@app.route('/api/pomodoro/daily-stats', methods=['GET'])
def get_daily_pomodoro_stats():
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')
    user_id = get_current_user_id()
    
    if not start_date or not end_date:
        return jsonify({'error': 'startDate and endDate are required'}), 400
    
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    
    # Pomodoro session'larını getir
    sessions = PomodoroSession.query.filter(
        PomodoroSession.user_id == user_id,
        PomodoroSession.completed_at >= start,
        PomodoroSession.completed_at <= end.replace(hour=23, minute=59, second=59)
    ).all()
    
    # Günlük istatistikleri hesapla
    daily_stats_map = {}
    
    # Tüm günleri başlat (0 ile)
    current_date = start.date()
    end_date_obj = end.date()
    while current_date <= end_date_obj:
        date_key = current_date.isoformat()
        daily_stats_map[date_key] = {'date': date_key, 'count': 0, 'minutes': 0}
        current_date += timedelta(days=1)
    
    # Session'ları günlere göre grupla
    for session in sessions:
        date_key = session.completed_at.date().isoformat()
        if date_key in daily_stats_map:
            daily_stats_map[date_key]['count'] += 1
            daily_stats_map[date_key]['minutes'] += session.duration
    
    # Listeye çevir ve sırala
    daily_stats = sorted(daily_stats_map.values(), key=lambda x: x['date'])
    
    return jsonify({'dailyStats': daily_stats})
```

---

## 🟡 Node.js/Express Örneği

```javascript
app.get('/api/pomodoro/daily-stats', async (req, res) => {
  const { startDate, endDate } = req.query;
  const userId = req.user.id;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  // Pomodoro session'larını getir
  const sessions = await PomodoroSession.find({
    userId,
    completedAt: { $gte: start, $lte: end }
  });
  
  // Günlük istatistikleri hesapla
  const dailyStatsMap = {};
  
  // Tüm günleri başlat (0 ile)
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyStatsMap[dateKey] = { date: dateKey, count: 0, minutes: 0 };
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Session'ları günlere göre grupla
  sessions.forEach(session => {
    const dateKey = new Date(session.completedAt).toISOString().split('T')[0];
    if (dailyStatsMap[dateKey]) {
      dailyStatsMap[dateKey].count += 1;
      dailyStatsMap[dateKey].minutes += session.duration || 0;
    }
  });
  
  // Listeye çevir ve sırala
  const dailyStats = Object.values(dailyStatsMap).sort((a, b) => 
    a.date.localeCompare(b.date)
  );
  
  res.json({ dailyStats });
});
```

---

## 📝 Önemli Notlar

1. **Tarih Formatı:** Tarihler `YYYY-MM-DD` formatında olmalıdır (ISO 8601).

2. **Boş Günler:** Eğer bir günde pomodoro yoksa, o gün için `count: 0, minutes: 0` döndürülmelidir.

3. **Sıralama:** Günlük istatistikler tarihe göre sıralı olmalıdır (küçükten büyüğe).

4. **Fallback:** Frontend'de backend endpoint'i yoksa, localStorage'dan veri yüklenecektir.

---

## ✅ Test Senaryosu

1. **2 pomodoro tamamlayın** (25 dakika × 2 = 50 dakika) - Bugün
2. **1 pomodoro tamamlayın** (25 dakika) - Dün
3. **Endpoint'i çağırın:**
   ```
   GET /api/pomodoro/daily-stats?startDate=2025-01-14&endDate=2025-01-16
   ```
4. **Beklenen Response:**
   ```json
   {
     "dailyStats": [
       {
         "date": "2025-01-14",
         "count": 1,
         "minutes": 25
       },
       {
         "date": "2025-01-15",
         "count": 2,
         "minutes": 50
       },
       {
         "date": "2025-01-16",
         "count": 0,
         "minutes": 0
       }
     ]
   }
   ```

---

## 🔄 Frontend Entegrasyonu

Frontend'de bu endpoint kullanılıyor:

```javascript
const loadPomodoroDailyStats = async () => {
  try {
    const response = await api.get("/api/pomodoro/daily-stats", {
      params: {
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      }
    });
    
    if (response.data && response.data.dailyStats) {
      const dailyStats = {};
      response.data.dailyStats.forEach(stat => {
        dailyStats[stat.date] = {
          count: stat.count || 0,
          minutes: stat.minutes || 0
        };
      });
      setPomodoroDailyStats(dailyStats);
    }
  } catch (error) {
    // Fallback: localStorage'dan yükle
    console.error("Günlük pomodoro istatistikleri yüklenemedi:", error);
  }
};
```

Eğer backend endpoint'i yoksa, frontend localStorage'dan veri yükleyecektir (kullanıcıya özel).










