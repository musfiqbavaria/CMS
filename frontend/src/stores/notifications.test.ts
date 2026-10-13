import { describe, expect, it } from "vitest";
import { unreadCount, useNotificationsStore } from "./notifications";

describe("notifications store", () => {
  it("pushes, counts unread, and marks read", () => {
    useNotificationsStore.setState({ items: [] });
    const store = useNotificationsStore.getState();
    store.push({ title: "Site down" });
    store.push({ title: "SSL expiring" });
    expect(unreadCount(useNotificationsStore.getState().items)).toBe(2);
    const firstId = useNotificationsStore.getState().items[0].id;
    useNotificationsStore.getState().markOneRead(firstId);
    expect(unreadCount(useNotificationsStore.getState().items)).toBe(1);
    useNotificationsStore.getState().markAllRead();
    expect(unreadCount(useNotificationsStore.getState().items)).toBe(0);
  });
});
