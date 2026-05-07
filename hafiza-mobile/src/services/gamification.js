import api from "./api";

function mapState(data) {
  if (!data || typeof data !== "object") return null;
  const tasks = Array.isArray(data.dailyTasks)
    ? data.dailyTasks.map((t) => ({
        id: t.id,
        title: t.title,
        metric: t.metric,
        target: Number(t.target || 0),
        rewardPoints: Number(t.rewardPoints || 0),
        rewardGold: Number(t.rewardGold || 0),
        completed: Boolean(t.completed),
        assignedBy: t.assignedBy || "server",
      }))
    : [];
  return {
    points: Number(data.points || 0),
    gold: Number(data.gold || 0),
    dailyTaskDate: data.dailyTaskDate || null,
    dailyTasks: tasks,
    ownedItems: Array.isArray(data.ownedItems) ? data.ownedItems : [],
    activeEffects: Array.isArray(data.activeEffects) ? data.activeEffects : [],
    solved: Number(data.solved ?? 0),
    correct: Number(data.correct ?? 0),
    sessions: Number(data.sessions ?? 0),
  };
}

export async function fetchGamificationState() {
  try {
    const { data } = await api.get("/api/gamification/state");
    return mapState(data);
  } catch {
    return null;
  }
}

export async function syncGamification() {
  try {
    const { data } = await api.post("/api/gamification/sync");
    const state = mapState(data?.state);
    return {
      state,
      earnedPoints: Number(data?.earnedPoints || 0),
      earnedGold: Number(data?.earnedGold || 0),
    };
  } catch {
    return { state: null, earnedPoints: 0, earnedGold: 0 };
  }
}

/** Tam senkron öncesi görev tamamlanma durumu (ödül bildirimi için; web DailyTasks ile aynı akış) */
export async function fetchDailyTasksSnapshot() {
  try {
    const { data } = await api.get("/api/gamification/daily-tasks");
    const raw = Array.isArray(data?.dailyTasks) ? data.dailyTasks : [];
    const tasks = raw.map((t) => ({
      id: t.id,
      completed: Boolean(t.completed),
    }));
    return { tasks, ok: true };
  } catch {
    return { tasks: [], ok: false };
  }
}

export async function fetchMarketItemsFromApi() {
  try {
    const { data } = await api.get("/api/gamification/market-items");
    if (Array.isArray(data) && data.length > 0) {
      return data.map((i) => ({
        id: i.id,
        label: i.label,
        desc: i.desc || "",
        price: Number(i.price || 0),
      }));
    }
  } catch {
    /* */
  }
  return null;
}

export async function purchaseMarketItem(itemId) {
  try {
    const { data } = await api.post("/api/gamification/purchase", { itemId });
    return { state: mapState(data), error: null };
  } catch (e) {
    const msg = e?.response?.data?.message || e?.response?.data || e?.message;
    const err = typeof msg === "string" ? msg : "Satin alinamadi";
    return { state: null, error: err };
  }
}
