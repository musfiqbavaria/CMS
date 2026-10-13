import { create } from "zustand";

export interface AppNotification {
  id: string;
  title: string;
  createdAt: string;
  read: boolean;
}

/** Live notifications arrive via WebSocket in Phase 8; the store shape is final. */
interface NotificationsState {
  items: AppNotification[];
  push: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  items: [],
  push: (n) =>
    set((s) => ({
      items: [
        { ...n, id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), read: false },
        ...s.items,
      ].slice(0, 50),
    })),
  markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
}));

export function unreadCount(items: AppNotification[]): number {
  return items.filter((i) => !i.read).length;
}
