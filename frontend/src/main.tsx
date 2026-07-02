import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";
import { useThemeStore } from "./store/themeStore";

document.documentElement.classList.toggle("dark", useThemeStore.getState().theme === "dark");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" toastOptions={{ style: { fontSize: "14px" } }} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
