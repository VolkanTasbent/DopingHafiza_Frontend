// src/services/api.js
import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

// API kökü /api ile biterse onu static dosyalar için kırp
export const API_ROOT = BASE.replace(/\/api\/?$/, "");

// Göreli bir /files/… yolunu tam URL’ye çevirir
export function fileUrl(p) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;     // zaten tam URL ise dokunma
  return `${API_ROOT}${p}`;                  // örn: http://localhost:8080 + /files/abc.jpg
}

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
