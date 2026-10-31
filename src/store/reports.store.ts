import { create } from 'zustand';

interface ReportsState {
  openedReportIds: Set<string>;
  markReportAsOpened: (id: string) => void;
  setOpenedReportIds: (ids: Set<string>) => void;
  isReportOpened: (id: string) => boolean;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  openedReportIds: new Set<string>(),

  markReportAsOpened: (id: string) =>
    set((state) => {
      const next = new Set(state.openedReportIds);
      next.add(id);
      return { openedReportIds: next };
    }),

  setOpenedReportIds: (ids: Set<string>) =>
    set((state) => {
      const next = new Set([...state.openedReportIds, ...ids]);
      return { openedReportIds: next };
    }),

  isReportOpened: (id: string) => get().openedReportIds.has(id),
}));
