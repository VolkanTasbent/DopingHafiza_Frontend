import axios from "axios";
import { getToken } from "./storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
