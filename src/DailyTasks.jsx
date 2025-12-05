// src/DailyTasks.jsx
import { useEffect, useState } from "react";
import api from "./services/api";
import "./DailyTasks.css";
import confetti from "canvas-confetti";

export default function DailyTasks({ onBack }) {
  const [stats, setStats] = useState({
    solved: 0,
    correct: 0,
    sessions: 0
  });

  const [completed, setCompleted] = useState({
    task1: false,
    task2: false,
    task3: false
  });

  const [showReward, setShowReward] = useState(false);
  const [rewardText, setRewardText] = useState("");

  useEffect(() => {
    loadStats();
    loadSavedTasks();
  }, []);

  const loadStats = async () => {
    const { data } = await api.get("/api/raporlar", { params: { limit: 200 } });

    const today = new Date().toLocaleDateString("tr-TR");

    const todayData = data.filter(
      (x) => new Date(x.finishedAt).toLocaleDateString("tr-TR") === today
    );

    const solved = todayData.reduce((a, r) => a + (r.totalCount || 0), 0);
    const correct = todayData.reduce((a, r) => a + (r.correctCount || 0), 0);
    const sessions = todayData.length;

    setStats({ solved, correct, sessions });

    checkTasks(solved, correct, sessions);
  };

  const loadSavedTasks = () => {
    const saved = localStorage.getItem("dailyTasks");
    if (saved) {
      const parsed = JSON.parse(saved);

      const today = new Date().toLocaleDateString("tr-TR");
      if (parsed.date !== today) {
        // yeni gün → reset
        resetTasks();
      } else {
        setCompleted(parsed.completed);
      }
    }
  };

  const saveTasks = (updated) => {
    const today = new Date().toLocaleDateString("tr-TR");
    localStorage.setItem(
      "dailyTasks",
      JSON.stringify({ date: today, completed: updated })
    );
  };

  const resetTasks = () => {
    const today = new Date().toLocaleDateString("tr-TR");
    const base = {
      date: today,
      completed: { task1: false, task2: false, task3: false }
    };
    localStorage.setItem("dailyTasks", JSON.stringify(base));
    setCompleted(base.completed);
  };

  const checkTasks = (solved, correct, sessions) => {
    const updated = { ...completed };
    let changed = false;

    if (!updated.task1 && solved >= 20) {
      updated.task1 = true;
      giveReward("+20 XP", "Bugün 20 soru çözdün!");
      changed = true;
    }

    if (!updated.task2 && correct >= 10) {
      updated.task2 = true;
      giveReward("+15 XP", "10 doğru cevap yaptın!");
      changed = true;
    }

    if (!updated.task3 && sessions >= 1) {
      updated.task3 = true;
      giveReward("+10 XP", "Bir ders testi başlattın!");
      changed = true;
    }

    if (changed) {
      setCompleted(updated);
      saveTasks(updated);
    }
  };

  const giveReward = (xp, text) => {
    setRewardText(`${text} (${xp})`);
    setShowReward(true);

    confetti({
      particleCount: 130,
      spread: 80,
      origin: { y: 0.7 }
    });

    setTimeout(() => setShowReward(false), 2500);
  };

  return (
    <div className="tasks-container">
      <h1 className="tasks-title">📅 Günlük Görevler</h1>

      <TaskItem
        title="Bugün 20 soru çöz"
        done={completed.task1}
        value={`${stats.solved}/20`}
      />

      <TaskItem
        title="10 doğru cevap yap"
        done={completed.task2}
        value={`${stats.correct}/10`}
      />

      <TaskItem
        title="1 test başlat"
        done={completed.task3}
        value={`${stats.sessions}/1`}
      />

      {showReward && (
        <div className="reward-popup">
          <div className="reward-box">
            <h2>🎉 Görev Tamamlandı!</h2>
            <p>{rewardText}</p>
          </div>
        </div>
      )}

      <button className="back-btn" onClick={onBack}>
        ◀ Geri Dön
      </button>
    </div>
  );
}

function TaskItem({ title, done, value }) {
  return (
    <div className={`task-card ${done ? "completed" : ""}`}>
      <div>
        <h3>{title}</h3>
        <p>{value}</p>
      </div>

      {done ? <span className="check">✔</span> : <span className="pending">⌛</span>}
    </div>
  );
}
