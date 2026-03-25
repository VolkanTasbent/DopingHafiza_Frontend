import { getJSON, setJSON } from "./storage";

const KEY = "recent_activities";

export async function addActivity(activity) {
  const existing = await getJSON(KEY, []);
  const list = Array.isArray(existing) ? existing : [];
  const meta = activity?.meta && typeof activity.meta === "object" ? activity.meta : undefined;
  const item = {
    id: `a-${Date.now()}`,
    title: activity?.title || "Aktivite",
    subtitle: activity?.subtitle || "",
    type: activity?.type || "general",
    at: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };
  const next = [item, ...list].slice(0, 50);
  await setJSON(KEY, next);
  return item;
}

export async function getRecentActivities(limit = 8) {
  const existing = await getJSON(KEY, []);
  const list = Array.isArray(existing) ? existing : [];
  return list.slice(0, limit);
}
