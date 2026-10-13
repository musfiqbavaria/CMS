import { describe, expect, it } from "vitest";
import { useUiStore } from "./ui";

describe("ui store", () => {
  it("toggles theme and sidebar", () => {
    const start = useUiStore.getState().theme;
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe(start === "light" ? "dark" : "light");
    useUiStore.getState().toggleTheme();

    const collapsed = useUiStore.getState().sidebarCollapsed;
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(!collapsed);
  });
});
