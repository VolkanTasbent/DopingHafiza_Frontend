import api from "./api";

export const kullanicilariGetir = () => api.get("/api/users").then(r => r.data);
export const kullaniciEkle = (g) => api.post("/api/users", g).then(r => r.data);
export const kullaniciGuncelle = (id, g) => api.put(`/api/users/${id}`, g).then(r => r.data);
export const kullaniciSil = (id) => api.delete(`/api/users/${id}`).then(r => r.data);
