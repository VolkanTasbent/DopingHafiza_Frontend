import api from "./api";

function mapRow(dto) {
  if (!dto || dto.id == null) return null;
  const savedAt = dto.savedAt || dto.createdAt;
  return {
    id: dto.id,
    savedAt: typeof savedAt === "string" ? savedAt : savedAt ? new Date(savedAt).toISOString() : new Date().toISOString(),
    title: dto.title || "",
    summary: dto.summary || "",
    days: dto.analyzedDays,
    dailyMinutes: dto.dailyMinutes,
    mode: dto.mode || "mixed",
    tasks: Array.isArray(dto.tasks) ? dto.tasks : [],
    focusTips: Array.isArray(dto.focusTips) ? dto.focusTips : [],
    weakTopicsPreview: Array.isArray(dto.weakTopicsPreview) ? dto.weakTopicsPreview : [],
  };
}

export async function loadSavedPlans() {
  const { data } = await api.get("/api/ai/saved-study-plans");
  if (!Array.isArray(data)) return [];
  return data.map(mapRow).filter(Boolean);
}

export async function saveStudyPlanEntry(plan, analysis, options = {}) {
  const title =
    options.title ||
    `Calisma programi — ${new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}`;
  const weakTopicsPreview = Array.isArray(analysis?.weakTopics)
    ? analysis.weakTopics.slice(0, 8).map((t) => `${t.dersAd} / ${t.konuAd} (risk %${t.riskScore})`)
    : [];
  const body = {
    title,
    summary: plan?.summary || "",
    analyzedDays: plan?.analyzedDays ?? null,
    dailyMinutes: plan?.dailyMinutes ?? null,
    mode: plan?.mode || "mixed",
    tasks: Array.isArray(plan?.tasks) ? plan.tasks : [],
    focusTips: Array.isArray(analysis?.focusTips) ? analysis.focusTips : [],
    weakTopicsPreview,
  };
  const { data } = await api.post("/api/ai/saved-study-plans", body);
  return mapRow(data);
}

export async function removeSavedPlan(id) {
  await api.delete(`/api/ai/saved-study-plans/${id}`);
}
