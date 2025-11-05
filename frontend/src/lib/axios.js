import axios from "axios";

// Prefer explicit API base from environment; fallback to dev localhost or relative /api
const API_BASE = (() => {
  const envUrl = import.meta.env?.VITE_API_BASE_URL || "";
  if (envUrl) {
    // Trim trailing slashes for consistency
    return envUrl.replace(/\/+$/, "");
  }
  return import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api";
})();

export const axiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});
