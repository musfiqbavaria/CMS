import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SidebarDesktop } from "./Sidebar";
import { useAuthStore } from "../../stores/auth";
import { useUiStore } from "../../stores/ui";

describe("Sidebar", () => {
  it("renders every menu entry", () => {
    useAuthStore.setState({ user: { id: 1, username: "boss", email: "b@x.com", first_name: "", last_name: "", role: "superadmin", is_2fa_enabled: false }, status: "authenticated", accessToken: "x" });
    useUiStore.setState({ sidebarCollapsed: false });
    render(
      <MemoryRouter>
        <SidebarDesktop />
      </MemoryRouter>,
    );
    for (const label of ["Dashboard", "Websites", "Add Website", "Build Website", "Overview", "Pages", "Media Library", "Monitoring", "Audit Logs", "Users & Roles", "Settings"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    useAuthStore.getState().clearSession();
  });
});
