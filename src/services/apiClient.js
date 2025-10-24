// src/apiClient.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

function getToken() {
  return localStorage.getItem("token");
}
function setAuth(data) {
  if (data?.token) localStorage.setItem("token", data.token);
  if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
}
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
export function currentUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
}

export async function api(path, { method="GET", body, headers={} } = {}) {
  const opts = { method, headers: { "Content-Type": "application/json", ...headers } };
  const t = getToken();
  if (t) opts.headers["Authorization"] = `Bearer ${t}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    let msg = "";
    try { const j = await res.json(); msg = j.error || JSON.stringify(j); } catch { msg = await res.text(); }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// Auth
export async function register(email, password, fullName) {
  const data = await api("/api/auth/register", { method:"POST", body:{ email, password, fullName }});
  setAuth(data); return data.user;
}
export async function login(email, password) {
  const data = await api("/api/auth/login", { method:"POST", body:{ email, password }});
  setAuth(data); return data.user;
}

// API’ler
export const DersAPI = {
  list: () => api("/api/ders"),
  create: (payload) => api("/api/ders", { method:"POST", body: payload }),
  remove: (id) => api(`/api/ders/${id}`, { method:"DELETE" }),
};
export const KonuAPI = {
  listByDers: (dersId) => api(`/api/konu?dersId=${dersId}`),
  create: (payload) => api("/api/konu", { method:"POST", body: payload }),
  remove: (id) => api(`/api/konu/${id}`, { method:"DELETE" }),
};
export const SoruAPI = {
  list: (dersId, limit=5) => api(`/api/soru?dersId=${dersId}&limit=${limit}`),
  create: (payload) => api("/api/soru", { method:"POST", body: payload }),
  update: (id, payload) => api(`/api/soru/${id}`, { method:"PUT", body: payload }),
  remove: (id) => api(`/api/soru/${id}`, { method:"DELETE" }),
  importCsv: (dersId, file) => upload(`/api/soru/import?dersId=${dersId}`, file),
};
export const QuizAPI = {
  start: (dersId) => api("/api/quiz-oturumu", { method:"POST", body:{ dersId }}),
  sendAnswers: (payload) => api("/api/cevap/bulk", { method:"POST", body: payload }),
};
export const RaporAPI = {
  list: (limit=20) => api(`/api/rapor/oturumlar?limit=${limit}`),
  detail: (id) => api(`/api/rapor/oturum/${id}/detay`),
};
export async function upload(path, file) {
  const form = new FormData();
  form.append("file", file);
  const t = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { url: "/images/xxx.jpg" }
}
export async function uploadImage(file) {
  return upload("/api/upload/image", file);
}
