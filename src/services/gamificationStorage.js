import api from "./api";

const STORAGE_KEY = "gamification_state_v2";

const DEFAULT_STATE = {
  points: 0,
  gold: 0,
  ownedItems: [],
  activeEffects: [],
  dailyTasks: { date: null, tasks: [] },
  lastReportTotals: { solved: 0, correct: 0, sessions: 0 },
  updatedAt: null,
};

/** Sunucu ile aynı ID’ler (backend GamificationService); UI yedek listesi */
export const DEFAULT_MARKET_ITEMS = [
  { id: "xp_boost_24h", label: "24 Saat XP Boost", price: 60, desc: "24 saat boyunca puan kazancin %20 artar." },
  { id: "gold_boost_24h", label: "24 Saat Altin Boost", price: 45, desc: "24 saat boyunca altin kazancin %30 artar." },
  { id: "extra_task_slot", label: "Ek Gunluk Gorev Slotu", price: 110, desc: "Gunluk gorevlerine 1 ek gorev eklenir." },
  { id: "instant_points_pack", label: "Anlik +120 Puan", price: 30, desc: "Satın alir almaz 120 puan eklenir." },
  { id: "instant_gold_pack", label: "Anlik +40 Altin", price: 50, desc: "Satın alir almaz 40 altin eklenir." },
];

let cachedMarketItems = null;

function todayKey() {
  return new Date().toLocaleDateString("tr-TR");
}

/** GET /api/gamification/state DTO → dahili şekil */
function mapApiStateDto(dto) {
  if (!dto || typeof dto !== "object") return { ...DEFAULT_STATE };
  const tasks = Array.isArray(dto.dailyTasks)
    ? dto.dailyTasks.map((t) => ({
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
  const date = dto.dailyTaskDate || null;
  return {
    ...DEFAULT_STATE,
    points: Number(dto.points || 0),
    gold: Number(dto.gold || 0),
    ownedItems: Array.isArray(dto.ownedItems) ? [...dto.ownedItems] : [],
    activeEffects: Array.isArray(dto.activeEffects)
      ? dto.activeEffects.map((e) => ({
          id: e.id,
          expiresAt: e.expiresAt || null,
        }))
      : [],
    dailyTasks: { date, tasks },
    lastReportTotals: {
      solved: Number(dto.solved ?? 0),
      correct: Number(dto.correct ?? 0),
      sessions: Number(dto.sessions ?? 0),
    },
    updatedAt: new Date().toISOString(),
  };
}

function toSafeState(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATE };
  const tasks = Array.isArray(raw?.dailyTasks?.tasks)
    ? raw.dailyTasks.tasks
    : Array.isArray(raw.dailyTasks)
      ? raw.dailyTasks
      : [];
  const date = raw?.dailyTasks?.date ?? raw.dailyTaskDate ?? null;
  return {
    ...DEFAULT_STATE,
    ...raw,
    ownedItems: Array.isArray(raw.ownedItems) ? raw.ownedItems : [],
    activeEffects: Array.isArray(raw.activeEffects) ? raw.activeEffects : [],
    dailyTasks: {
      date,
      tasks,
    },
    lastReportTotals: {
      solved: Number(raw?.lastReportTotals?.solved ?? raw?.solved ?? 0),
      correct: Number(raw?.lastReportTotals?.correct ?? raw?.correct ?? 0),
      sessions: Number(raw?.lastReportTotals?.sessions ?? raw?.sessions ?? 0),
    },
    points: Number(raw.points || 0),
    gold: Number(raw.gold || 0),
  };
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return toSafeState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeLocalState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readRemoteStateFromMe(meData) {
  if (!meData || typeof meData !== "object") return null;
  const candidates = [
    meData.gamificationState,
    meData.gamification_state,
    meData.gameState,
    meData.game_state,
  ];
  const value = candidates.find(Boolean);
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return toSafeState(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return toSafeState(value);
}

/** Backend JSON blob (user.gamification_state) ile uyumlu */
function toBackendGamificationJson(state) {
  const s = toSafeState(state);
  return JSON.stringify({
    points: s.points,
    gold: s.gold,
    dailyTaskDate: s.dailyTasks?.date || "",
    dailyTasks: s.dailyTasks?.tasks || [],
    ownedItems: s.ownedItems || [],
    activeEffects: s.activeEffects || [],
    lastReportTotals: s.lastReportTotals || { solved: 0, correct: 0, sessions: 0 },
  });
}

async function persistViaUsersMe(state) {
  await api.put("/api/users/me", {
    gamificationState: toBackendGamificationJson(state),
    puan: state.points,
    altin: state.gold,
  });
}

/**
 * Sunucu gamification API’si var mı dene
 */
async function tryGetApiState() {
  const { data } = await api.get("/api/gamification/state");
  return mapApiStateDto(data);
}

async function tryPostSync() {
  const { data } = await api.post("/api/gamification/sync");
  const state = mapApiStateDto(data?.state);
  return { state, earnedPoints: data?.earnedPoints ?? 0, earnedGold: data?.earnedGold ?? 0 };
}

async function tryPostPurchase(itemId) {
  const { data } = await api.post("/api/gamification/purchase", { itemId });
  return mapApiStateDto(data);
}

export async function fetchMarketItems() {
  if (cachedMarketItems?.length) return cachedMarketItems;
  try {
    const { data } = await api.get("/api/gamification/market-items");
    if (Array.isArray(data) && data.length > 0) {
      cachedMarketItems = data.map((i) => ({
        id: i.id,
        label: i.label,
        price: Number(i.price || 0),
        desc: i.desc || "",
      }));
      return cachedMarketItems;
    }
  } catch {
    /* yok */
  }
  cachedMarketItems = DEFAULT_MARKET_ITEMS;
  return cachedMarketItems;
}

export function clearMarketItemsCache() {
  cachedMarketItems = null;
}

export async function loadGamificationState() {
  try {
    const state = await tryGetApiState();
    writeLocalState(state);
    return state;
  } catch {
    /* devam */
  }

  const localState = readLocalState();
  try {
    const { data } = await api.get("/api/users/me");
    const remoteState = readRemoteStateFromMe(data);
    if (remoteState) {
      const merged = toSafeState({
        ...remoteState,
        points: data.puan ?? remoteState.points,
        gold: data.altin ?? remoteState.gold,
      });
      writeLocalState(merged);
      return merged;
    }
    if (data?.puan != null || data?.altin != null) {
      const merged = { ...localState, points: data.puan ?? localState.points, gold: data.altin ?? localState.gold };
      writeLocalState(merged);
      return merged;
    }
  } catch {
    /* */
  }
  return localState;
}

/**
 * Sunucu rapor özetlerine göre puan/altın/görev senkronu. Önce POST /api/gamification/sync.
 */
export async function syncProgressWithReports(reports = [], currentState) {
  try {
    const { state } = await tryPostSync();
    writeLocalState(state);
    return state;
  } catch {
    /* eski istemci mantığı */
  }

  return syncProgressWithReportsLocal(reports, currentState);
}

function isEffectActive(effect) {
  if (!effect?.expiresAt) return true;
  return new Date(effect.expiresAt).getTime() > Date.now();
}

function filterActiveEffects(effects) {
  return (effects || []).filter(isEffectActive);
}

async function generateAiDailyTasks(stats, slotCount = 3) {
  try {
    const { data } = await api.get("/api/ai/suggest-study-plan", {
      params: { days: 1, dailyMinutes: 90, mode: "mixed" },
    });
    const topics = Array.isArray(data?.topics) ? data.topics : [];
    const planTasks = topics.slice(0, slotCount).map((topic, idx) => ({
      id: `ai_${Date.now()}_${idx}`,
      title: `${topic?.name || "Konu"} icin mini gorev`,
      metric: "solved",
      target: 8 + idx * 4,
      rewardPoints: 20 + idx * 8,
      rewardGold: 2 + idx,
      completed: false,
      assignedBy: "ai",
    }));
    if (planTasks.length > 0) return planTasks;
  } catch {
    /* */
  }

  const solvedTarget = Math.max(15, Math.min(60, Math.round((stats.solved || 0) * 0.5) + 15));
  const correctTarget = Math.max(8, Math.min(40, Math.round((stats.correct || 0) * 0.5) + 8));
  const sessionTarget = 2;

  const fallback = [
    {
      id: `ai_${Date.now()}_s`,
      title: `Bugun ${solvedTarget} soru coz`,
      metric: "solved",
      target: solvedTarget,
      rewardPoints: 30,
      rewardGold: 4,
      completed: false,
      assignedBy: "ai",
    },
    {
      id: `ai_${Date.now()}_c`,
      title: `${correctTarget} dogru cevaba ulas`,
      metric: "correct",
      target: correctTarget,
      rewardPoints: 24,
      rewardGold: 3,
      completed: false,
      assignedBy: "ai",
    },
    {
      id: `ai_${Date.now()}_x`,
      title: `${sessionTarget} calisma oturumu tamamla`,
      metric: "sessions",
      target: sessionTarget,
      rewardPoints: 16,
      rewardGold: 2,
      completed: false,
      assignedBy: "ai",
    },
  ];
  return fallback.slice(0, slotCount);
}

async function syncProgressWithReportsLocal(reports = [], currentState) {
  const state = toSafeState(currentState);
  const cleanedEffects = filterActiveEffects(state.activeEffects);

  const totals = {
    solved: reports.reduce((a, r) => a + Number(r?.totalCount || 0), 0),
    correct: reports.reduce((a, r) => a + Number(r?.correctCount || 0), 0),
    sessions: reports.length,
  };

  const deltaSolved = Math.max(0, totals.solved - state.lastReportTotals.solved);
  const deltaCorrect = Math.max(0, totals.correct - state.lastReportTotals.correct);
  const deltaSessions = Math.max(0, totals.sessions - state.lastReportTotals.sessions);

  const xpBoost = cleanedEffects.some((x) => x.id === "xp_boost_24h") ? 1.2 : 1;
  const goldBoost = cleanedEffects.some((x) => x.id === "gold_boost_24h") ? 1.3 : 1;

  const rawPointsGain = deltaSolved + deltaCorrect * 5 + deltaSessions * 2;
  const pointsGain = Math.round(rawPointsGain * xpBoost);
  const goldGain = Math.round(Math.floor(pointsGain / 20) * goldBoost);

  let nextState = {
    ...state,
    points: state.points + pointsGain,
    gold: state.gold + goldGain,
    activeEffects: cleanedEffects,
    lastReportTotals: totals,
  };

  const slotBonus = nextState.ownedItems.includes("extra_task_slot") ? 1 : 0;
  const slotCount = 3 + slotBonus;
  if (nextState.dailyTasks.date !== todayKey()) {
    const tasks = await generateAiDailyTasks(totals, slotCount);
    nextState = {
      ...nextState,
      dailyTasks: { date: todayKey(), tasks },
    };
  }

  return saveGamificationState(nextState);
}

export async function saveGamificationState(nextState) {
  const state = { ...toSafeState(nextState), updatedAt: new Date().toISOString() };
  writeLocalState(state);
  try {
    await persistViaUsersMe(state);
  } catch {
    /* */
  }
  return state;
}

/**
 * Milestone vb. sadece puan/altın ekler; sunucu API yoksa users/me yazar.
 */
export async function addPointsAndGold(pointsDelta, goldDelta, baseState) {
  const s = toSafeState(baseState);
  const next = {
    ...s,
    points: Math.max(0, s.points + (pointsDelta || 0)),
    gold: Math.max(0, s.gold + (goldDelta || 0)),
  };
  writeLocalState(next);
  try {
    await api.put("/api/users/me", {
      gamificationState: toBackendGamificationJson(next),
      puan: next.points,
      altin: next.gold,
    });
  } catch {
    /* */
  }
  return next;
}

export async function completeDailyTasksFromStats(stats, currentState) {
  try {
    const { state } = await tryPostSync();
    writeLocalState(state);
    return state;
  } catch {
    /* */
  }

  const state = toSafeState(currentState);
  if (state.dailyTasks.date !== todayKey()) return state;
  let changed = false;

  const tasks = state.dailyTasks.tasks.map((task) => {
    if (task.completed) return task;
    const value = Number(stats?.[task.metric] || 0);
    if (value >= Number(task.target || 0)) {
      changed = true;
      return { ...task, completed: true };
    }
    return task;
  });

  if (!changed) return state;

  const newlyCompleted = tasks.filter(
    (t) => t.completed && !state.dailyTasks.tasks.find((o) => o.id === t.id && o.completed)
  );
  const extraPoints = newlyCompleted.reduce((a, t) => a + Number(t.rewardPoints || 0), 0);
  const extraGold = newlyCompleted.reduce((a, t) => a + Number(t.rewardGold || 0), 0);

  return saveGamificationState({
    ...state,
    points: state.points + extraPoints,
    gold: state.gold + extraGold,
    dailyTasks: { ...state.dailyTasks, tasks },
  });
}

export async function buyMarketItem(itemId, currentState) {
  try {
    const state = await tryPostPurchase(itemId);
    writeLocalState(state);
    const items = await fetchMarketItems();
    const item = items.find((x) => x.id === itemId);
    return { state, item };
  } catch (e) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.message || e?.response?.data || e?.message || "Satin alma basarisiz";
    const errText = typeof msg === "string" ? msg : "Satin alma basarisiz";
    if (status && status < 500) {
      return { state: toSafeState(currentState), error: errText };
    }
    return buyMarketItemLocal(itemId, currentState);
  }
}

async function buyMarketItemLocal(itemId, currentState) {
  const state = toSafeState(currentState);
  const items = cachedMarketItems || DEFAULT_MARKET_ITEMS;
  const item = items.find((x) => x.id === itemId);
  if (!item) return { state, error: "Urun bulunamadi." };
  if (state.ownedItems.includes(item.id) && !item.id.includes("instant_")) {
    return { state, error: "Bu urun zaten satin alinmis." };
  }
  if (state.gold < item.price) {
    return { state, error: "Yeterli altin yok." };
  }

  let nextState = { ...state, gold: state.gold - item.price };

  if (item.id === "xp_boost_24h" || item.id === "gold_boost_24h") {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    nextState.activeEffects = [
      ...state.activeEffects.filter((x) => x.id !== item.id),
      { id: item.id, expiresAt },
    ];
  } else if (item.id === "instant_points_pack") {
    nextState.points += 120;
  } else if (item.id === "instant_gold_pack") {
    nextState.gold += 40;
  }

  if (!item.id.includes("instant_") && !nextState.ownedItems.includes(item.id)) {
    nextState.ownedItems = [...nextState.ownedItems, item.id];
  }

  const saved = await saveGamificationState(nextState);
  return { state: saved, item };
}

export async function postGamificationSync() {
  const { state, earnedPoints, earnedGold } = await tryPostSync();
  writeLocalState(state);
  return { state, earnedPoints, earnedGold };
}

/** Eski importlar için; tercihen fetchMarketItems() / DEFAULT_MARKET_ITEMS kullanın */
export let MARKET_ITEMS = DEFAULT_MARKET_ITEMS;
fetchMarketItems().then((items) => {
  MARKET_ITEMS = items;
});
