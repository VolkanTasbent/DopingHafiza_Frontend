// DashboardPomodoroWidget.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Pause, Square } from 'lucide-react';

const DashboardPomodoroWidget = () => {
  const [isActive, setIsActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [duration, setDuration] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);

  // Widget durumunu senkronize et
  const fetchWidgetStatus = async () => {
    try {
      const response = await axios.get('/api/pomodoro/widget-status', {
        withCredentials: true
      });
      
      if (response.data.active) {
        setIsActive(true);
        setRemainingSeconds(response.data.remainingSeconds);
        setDuration(response.data.duration);
        setExpiresAt(new Date(response.data.expiresAt));
      } else {
        setIsActive(false);
        setRemainingSeconds(0);
      }
    } catch (error) {
      console.error('Widget durumu alınamadı:', error);
    }
  };

  // Her saniye güncelle
  useEffect(() => {
    fetchWidgetStatus();
    
    const interval = setInterval(() => {
      if (isActive && expiresAt) {
        const now = new Date();
        const diff = Math.floor((expiresAt - now) / 1000);
        if (diff > 0) {
          setRemainingSeconds(diff);
        } else {
          setIsActive(false);
          fetchWidgetStatus(); // Son durumu kontrol et
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, expiresAt]);

  // Her 10 saniyede bir senkronizasyon
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (isActive) {
        fetchWidgetStatus();
      }
    }, 10000); // 10 saniyede bir senkronize et

    return () => clearInterval(syncInterval);
  }, [isActive]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      await axios.post('/api/pomodoro/start', {
        duration: duration
      }, {
        withCredentials: true
      });
      await fetchWidgetStatus(); // Durumu yenile
    } catch (error) {
      console.error('Pomodoro başlatılamadı:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await axios.post('/api/pomodoro/stop', {}, {
        withCredentials: true
      });
      await fetchWidgetStatus(); // Durumu yenile
    } catch (error) {
      console.error('Pomodoro durdurulamadı:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    if (isActive) {
      await handleStop();
      // Session kaydet
      try {
        await axios.post('/api/pomodoro/session', {
          duration: duration,
          completedAt: new Date().toISOString()
        }, {
          withCredentials: true
        });
      } catch (error) {
        console.error('Session kaydedilemedi:', error);
      }
    }
  };

  return (
    <div className="pomodoro-widget">
      <div className="widget-header">
        <h3>🎯 Pomodoro</h3>
        <div className={`status-indicator ${isActive ? 'active' : 'inactive'}`}>
          {isActive ? 'Çalışıyor' : 'Duraklatıldı'}
        </div>
      </div>

      <div className="timer-display">
        <div className="time">
          {isActive ? formatTime(remainingSeconds) : `${duration}:00`}
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{
              width: isActive ? `${(remainingSeconds / (duration * 60)) * 100}%` : '0%'
            }}
          ></div>
        </div>
      </div>

      <div className="widget-controls">
        {!isActive ? (
          <button 
            onClick={handleStart}
            disabled={isLoading}
            className="btn-start"
          >
            <Play size={16} />
            Başlat
          </button>
        ) : (
          <div className="active-controls">
            <button 
              onClick={handleStop}
              disabled={isLoading}
              className="btn-pause"
            >
              <Pause size={16} />
              Duraklat
            </button>
            <button 
              onClick={handleComplete}
              disabled={isLoading}
              className="btn-complete"
            >
              <Square size={16} />
              Tamamla
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .pomodoro-widget {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
          max-width: 300px;
        }

        .widget-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .widget-header h3 {
          margin: 0;
          font-size: 18px;
          color: #1f2937;
        }

        .status-indicator {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-indicator.active {
          background: #dcfce7;
          color: #166534;
        }

        .status-indicator.inactive {
          background: #f3f4f6;
          color: #6b7280;
        }

        .timer-display {
          text-align: center;
          margin-bottom: 20px;
        }

        .time {
          font-size: 36px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 12px;
          font-family: 'Courier New', monospace;
        }

        .progress-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transition: width 1s linear;
        }

        .widget-controls {
          display: flex;
          justify-content: center;
        }

        button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-start {
          background: #3b82f6;
          color: white;
          width: 100%;
          justify-content: center;
        }

        .btn-start:hover:not(:disabled) {
          background: #2563eb;
        }

        .active-controls {
          display: flex;
          gap: 10px;
          width: 100%;
        }

        .btn-pause {
          background: #f59e0b;
          color: white;
          flex: 1;
          justify-content: center;
        }

        .btn-pause:hover:not(:disabled) {
          background: #d97706;
        }

        .btn-complete {
          background: #10b981;
          color: white;
          flex: 1;
          justify-content: center;
        }

        .btn-complete:hover:not(:disabled) {
          background: #059669;
        }
      `}</style>
    </div>
  );
};

export default DashboardPomodoroWidget;