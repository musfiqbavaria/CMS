import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BuilderState {
  siteId: number | null;
  setSiteId: (id: number | null) => void;
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set) => ({
      siteId: null,
      setSiteId: (siteId) => set({ siteId }),
    }),
    { name: "cms-builder" },
  ),
);
