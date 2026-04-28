import axios from "axios";
import { getApiBaseUrl } from "./apiBaseUrl";
import { getToken } from "./storage";

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
