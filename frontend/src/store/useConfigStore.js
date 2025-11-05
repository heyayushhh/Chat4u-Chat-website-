import { create } from "zustand";
import { axiosInstance } from "../lib/axios";

const defaultLimits = {
  imageMaxMB: 10,
  videoMaxMB: 50,
  pdfMaxMB: 25,
  messageMaxLength: 5000,
  maxAttachmentsPerMessage: 1,
};

export const useConfigStore = create((set) => ({
  limits: defaultLimits,
  isLoaded: false,
  loadConfig: async () => {
    try {
      const res = await axiosInstance.get("/config/public");
      const limits = res.data?.limits || defaultLimits;
      set({ limits, isLoaded: true });
    } catch (_) {
      set({ limits: defaultLimits, isLoaded: true });
    }
  },
}));