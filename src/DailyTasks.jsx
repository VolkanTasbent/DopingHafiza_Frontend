// src/DailyTasks.jsx
import { useEffect, useState } from "react";
import api from "./services/api";
import "./DailyTasks.css";
import confetti from "canvas-confetti";
import { postGamificationSync } from "./services/gamificationStorage";

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
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    let prevTasks = [];
    let hadPrevSnapshot = false;
    try {
      const { data } = await api.get("/api/gamification/daily-tasks");
      prevTasks = Array.isArray(data?.dailyTasks) ? data.dailyTasks : [];
      hadPrevSnapshot = true;
    } catch {
      prevTasks = [];
    }

    const { state, earnedPoints, earnedGold } = await postGamificationSync();

    const mappedTasks = state.dailyTasks?.tasks || [];
    setTasks(mappedTasks);
    setStats({
      solved: state.lastReportTotals?.solved ?? 0,
      correct: state.lastReportTotals?.correct ?? 0,
      sessions: state.lastReportTotals?.sessions ?? 0,
    });
    const updated = {
      task1: Boolean(mappedTasks[0]?.completed),
      task2: Boolean(mappedTasks[1]?.completed),
      task3: Boolean(mappedTasks[2]?.completed),
    };

    const prevDone = prevTasks.filter((t) => t.completed).length;
    const newDone = mappedTasks.filter((t) => t.completed).length;
    if (hadPrevSnapshot && newDone > prevDone) {
      const latest = mappedTasks.find(
        (t) => t.completed && !prevTasks.some((s) => s.id === t.id && s.completed)
      );
      if (latest) {
        giveReward(`+${latest.rewardPoints} Puan, +${latest.rewardGold} Altin`, latest.title);
      }
    } else if (hadPrevSnapshot && (earnedPoints > 0 || earnedGold > 0) && newDone === prevDone) {
      giveReward(`+${earnedPoints} Puan, +${earnedGold} Altin`, "Calisma ilerlemen kaydedildi!");
    }
    setCompleted(updated);
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
        title={tasks[0]?.title || "AI gorevi yukleniyor..."}
        done={completed.task1}
        value={`${stats[tasks[0]?.metric || "solved"] || 0}/${tasks[0]?.target || 0}`}
      />

      <TaskItem
        title={tasks[1]?.title || "AI gorevi yukleniyor..."}
        done={completed.task2}
        value={`${stats[tasks[1]?.metric || "correct"] || 0}/${tasks[1]?.target || 0}`}
      />

      <TaskItem
        title={tasks[2]?.title || "AI gorevi yukleniyor..."}
        done={completed.task3}
        value={`${stats[tasks[2]?.metric || "sessions"] || 0}/${tasks[2]?.target || 0}`}
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
