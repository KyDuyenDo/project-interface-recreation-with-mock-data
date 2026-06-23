import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: (() => {
    try {
      const u = localStorage.getItem("ap.user");
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  })(),
  token: localStorage.getItem("ap.token") || null,

  login: (user, token) => {
    localStorage.setItem("ap.user", JSON.stringify(user));
    localStorage.setItem("ap.token", token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem("ap.user");
    localStorage.removeItem("ap.token");
    set({ user: null, token: null });
  },
}));
