/**
 * Gorevleri secilen hafta icinde tarih (Pzt–Paz) ve musait gunlere gore yerlestirir.
 * - Oncelik: dusuk priority degeri = once (backend ile uyumlu).
 * - Gunluk ust sinir: dailyCapMinutes; sigmazsa en az yuklu musait gune eklenir (tasma).
 */

const DEFAULT_AVAILABLE = [true, true, true, true, true, false, false];

export function normalizeAvailableWeekdays(arr) {
  if (!Array.isArray(arr) || arr.length !== 7) return [...DEFAULT_AVAILABLE];
  return arr.map(Boolean);
}

export function assignTasksToWeekCalendar(tasks, options) {
  const {
    dailyCapMinutes,
    availableWeekday = DEFAULT_AVAILABLE,
  } = options || {};

  const avail = normalizeAvailableWeekdays(availableWeekday);
  if (!avail.some(Boolean)) {
    return {
      dayBuckets: Array.from({ length: 7 }, () => []),
      minutesUsed: Array(7).fill(0),
      overflowByDay: Array(7).fill(0),
      unassigned: [...(tasks || [])],
    };
  }

  const cap = Math.max(1, Number(dailyCapMinutes) || 120);
  const sorted = [...(tasks || [])].sort(
    (a, b) => (Number(a.priority) || 999) - (Number(b.priority) || 999)
  );

  const dayBuckets = Array.from({ length: 7 }, () => []);
  const minutesUsed = Array(7).fill(0);
  const unassigned = [];

  for (const task of sorted) {
    const m = Math.max(0, Number(task.estimatedMinutes) || 0);
    let placed = false;

    for (let i = 0; i < 7; i++) {
      if (!avail[i]) continue;
      if (minutesUsed[i] + m <= cap) {
        dayBuckets[i].push(task);
        minutesUsed[i] += m;
        placed = true;
        break;
      }
    }

    if (!placed) {
      let best = -1;
      let bestLoad = Infinity;
      for (let i = 0; i < 7; i++) {
        if (!avail[i]) continue;
        if (minutesUsed[i] < bestLoad) {
          bestLoad = minutesUsed[i];
          best = i;
        }
      }
      if (best >= 0) {
        dayBuckets[best].push(task);
        minutesUsed[best] += m;
      } else {
        unassigned.push(task);
      }
    }
  }

  const overflowByDay = minutesUsed.map((u, i) =>
    avail[i] && u > cap ? u - cap : 0
  );

  return { dayBuckets, minutesUsed, overflowByDay, unassigned };
}

export const WEEKDAY_STORAGE_KEY = "hafiza-cpp-weekdays";

export function loadWeekdayAvailability() {
  try {
    const raw = localStorage.getItem(WEEKDAY_STORAGE_KEY);
    if (!raw) return [...DEFAULT_AVAILABLE];
    const p = JSON.parse(raw);
    return normalizeAvailableWeekdays(p);
  } catch {
    return [...DEFAULT_AVAILABLE];
  }
}

export function saveWeekdayAvailability(weekdays) {
  try {
    localStorage.setItem(WEEKDAY_STORAGE_KEY, JSON.stringify(normalizeAvailableWeekdays(weekdays)));
  } catch {
    /* ignore */
  }
}
