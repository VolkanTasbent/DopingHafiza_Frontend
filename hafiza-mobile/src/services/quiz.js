import api from "./api";

export async function fetchDersler() {
  const { data } = await api.get("/api/ders");
  return Array.isArray(data) ? data : [];
}

export async function fetchKonular(dersId) {
  const { data } = await api.get("/api/konu", { params: { dersId } });
  return Array.isArray(data) ? data : [];
}

export async function fetchSorular({ dersId, konuId }) {
  const params = {
    dersId: Number(dersId),
    limit: 1000,
    excludeDenemeSinavi: true,
  };
  if (konuId) params.konuId = Number(konuId);

  const { data } = await api.get("/api/sorular", { params });
  return Array.isArray(data) ? data : [];
}

export async function fetchSoruDetay(soruId) {
  const { data } = await api.get(`/api/sorular/${soruId}`);
  return data;
}

export async function createSoru(payload) {
  const { data } = await api.post("/api/sorular", payload);
  return data;
}

export async function updateSoru(soruId, payload) {
  const { data } = await api.put(`/api/sorular/${soruId}`, payload);
  return data;
}

export async function removeSoru(soruId) {
  await api.delete(`/api/sorular/${soruId}`);
}

export async function createSecenek(soruId, payload) {
  const { data } = await api.post(`/api/sorular/${soruId}/secenekler`, payload);
  return data;
}

export async function updateSecenek(secenekId, payload) {
  const { data } = await api.put(`/api/sorular/secenekler/${secenekId}`, payload);
  return data;
}

export async function removeSecenek(secenekId) {
  await api.delete(`/api/sorular/secenekler/${secenekId}`);
}

export async function submitQuiz(payload) {
  const { data } = await api.post("/api/quiz/submit", payload);
  return data;
}

export async function fetchDenemeSinavlari() {
  const { data } = await api.get("/api/deneme-sinavi");
  return Array.isArray(data) ? data : [];
}

export async function fetchDenemeSorular(denemeId) {
  try {
    const { data } = await api.get(`/api/deneme-sinavlari/${denemeId}/quiz-sorular`);
    return Array.isArray(data) ? data : [];
  } catch {
    const { data } = await api.get(`/api/deneme-sinavlari/${denemeId}/sorular`);
    return Array.isArray(data) ? data : [];
  }
}

export async function fetchRaporlar(limit = 100) {
  const { data } = await api.get("/api/raporlar", { params: { limit } });
  return Array.isArray(data) ? data : [];
}

/** Takvim: detayli oturum (items, durationMs) icin once grafikler endpoint'i, yoksa raporlar listesi */
export async function fetchRaporlarGrafikler(limit = 500) {
  try {
    const { data } = await api.get("/api/raporlar/grafikler", { params: { limit } });
    if (Array.isArray(data)) return data;
  } catch {
    /* backend eski surum */
  }
  return fetchRaporlar(limit);
}

/** Gun bazli pomodoro (YYYY-MM-DD -> { count, minutes }). Bos map donerse yerel odak gecmisi kullanilabilir. */
export async function fetchPomodoroDailyStats(startDate, endDate) {
  try {
    const { data } = await api.get("/api/pomodoro/daily-stats", {
      params: { startDate, endDate },
    });
    const map = {};
    if (data?.dailyStats && Array.isArray(data.dailyStats)) {
      data.dailyStats.forEach((s) => {
        if (s?.date) map[String(s.date)] = { count: Number(s.count) || 0, minutes: Number(s.minutes) || 0 };
      });
    }
    return map;
  } catch {
    return {};
  }
}

export async function fetchRaporDetay(oturumId) {
  const { data } = await api.get(`/api/raporlar/${oturumId}/detay`);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function fetchProfile() {
  const { data } = await api.get("/api/users/me");
  return data;
}

export async function updateProfile(payload) {
  const { data } = await api.put("/api/users/me", payload);
  return data;
}

export async function uploadAvatar(asset) {
  if (!asset?.uri) throw new Error("Gecerli bir resim secilemedi.");
  const formData = new FormData();
  const ext = String(asset?.fileName || asset?.uri || "").split(".").pop() || "jpg";
  formData.append("file", {
    uri: asset.uri,
    name: asset.fileName || `avatar.${ext}`,
    type: asset.mimeType || "image/jpeg",
  });
  const { data } = await api.post("/api/files/upload-avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function fetchVideoNotes({ konuId, videoId, videoUrl }) {
  const params = { konuId };
  if (videoId) params.videoId = String(videoId);
  if (videoUrl) params.videoUrl = videoUrl;
  const { data } = await api.get("/api/video-notes", { params });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.notes)) return data.notes;
  return [];
}

export async function createVideoNote(payload) {
  const { data } = await api.post("/api/video-notes", payload);
  return data;
}

export async function updateVideoNote(noteId, payload) {
  const { data } = await api.put(`/api/video-notes/${noteId}`, payload);
  return data;
}

export async function deleteVideoNote(noteId) {
  await api.delete(`/api/video-notes/${noteId}`);
}

export async function fetchAiWeakTopics({ days = 30, limit = 8 } = {}) {
  const { data } = await api.get("/api/ai/analyze-weak-topics", { params: { days, limit } });
  return data || {};
}

export async function fetchAiStudyPlan({ days = 30, dailyMinutes = 120, mode = "mixed" } = {}) {
  const { data } = await api.get("/api/ai/suggest-study-plan", { params: { days, dailyMinutes, mode } });
  return data || {};
}

export async function sendAiChat(message) {
  const { data } = await api.post("/api/ai/chat", { message });
  return data || {};
}

export async function fetchAiAbCompare({ days = 30, limit = 8 } = {}) {
  const { data } = await api.get("/api/ai/ab-compare", { params: { days, limit } });
  return data || {};
}
