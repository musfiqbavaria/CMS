import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { SidebarDesktop, SidebarMobile } from "./Sidebar";
import { useAuthStore } from "../../stores/auth";
import { useUiStore } from "../../stores/ui";

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearSession();
  useUiStore.setState({ mobileNavOpen: false });
});

function signIn() {
  useAuthStore.setState({ user: { id: 1, username: "boss", email: "b@x.com", first_name: "", last_name: "", role: "superadmin", is_2fa_enabled: false }, status: "authenticated", accessToken: "x" });
  useUiStore.setState({ sidebarCollapsed: false });
}

describe("Sidebar", () => {
  it("renders every menu entry", () => {
    signIn();
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

  it("highlights only the child on /websites/new", () => {
    signIn();
    render(
      <MemoryRouter initialEntries={["/websites/new"]}>
        <SidebarDesktop />
      </MemoryRouter>,
    );
    expect(screen.getByText("Add Website").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Websites").closest("a")).not.toHaveAttribute("aria-current");
    useAuthStore.getState().clearSession();
  });

  it("highlights only the child on /builder/new", () => {
    signIn();
    render(
      <MemoryRouter initialEntries={["/builder/new"]}>
        <SidebarDesktop />
      </MemoryRouter>,
    );
    expect(screen.getByText("Build Website").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Overview").closest("a")).not.toHaveAttribute("aria-current");
    useAuthStore.getState().clearSession();
  });
  it("shows labels in the mobile drawer even with a collapsed desktop sidebar and closes on Escape", () => {
    signIn();
    useUiStore.setState({ mobileNavOpen: true, sidebarCollapsed: true });
    render(<MemoryRouter><SidebarMobile /></MemoryRouter>);
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveFocus();
    expect(screen.getByText("Websites")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
