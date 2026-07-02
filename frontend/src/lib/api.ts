import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/authStore";

// En développement (npm run dev), le proxy Vite redirige /api vers localhost:4000 (voir vite.config.ts).
// En production (Vercel), on utilise VITE_API_URL qui doit pointer vers votre backend Render,
// par exemple : https://quincaillerie-pro-api.onrender.com/api
const baseURL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.error || "Une erreur est survenue. Veuillez réessayer.";

    if (status === 401) {
      useAuthStore.getState().logout();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    } else {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);
