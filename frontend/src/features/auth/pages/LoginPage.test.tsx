import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmTwoFactorLogin, login } from "../api";
import LoginPage from "./LoginPage";

vi.mock("../api", () => ({
  login: vi.fn(),
  confirmTwoFactorLogin: vi.fn(),
}));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function renderLogin() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Workspace dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function submitCredentials() {
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "admin" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in to workspace" }));
}

describe("LoginPage", () => {
  it("keeps the password when visibility changes and signs in with the entered credentials", async () => {
    vi.mocked(login).mockResolvedValue({ requires_2fa: false });
    renderLogin();
    const password = screen.getByLabelText("Password");
    fireEvent.change(password, { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("test-password");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");

    submitCredentials();
    expect(await screen.findByText("Workspace dashboard")).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith("admin", "test-password");
  });

  it("validates the authenticator code and preserves leading zeroes when completing 2FA", async () => {
    vi.mocked(login).mockResolvedValue({ requires_2fa: true, two_fa_token: "challenge" });
    vi.mocked(confirmTwoFactorLogin).mockResolvedValue({ requires_2fa: false });
    renderLogin();
    submitCredentials();

    const code = await screen.findByLabelText("Authenticator code");
    expect(code).toHaveFocus();
    fireEvent.change(code, { target: { value: "abcdef" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByText("Enter the 6-digit code from your authenticator.")).toBeInTheDocument();
    expect(confirmTwoFactorLogin).not.toHaveBeenCalled();

    fireEvent.change(code, { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByText("Workspace dashboard")).toBeInTheDocument();
    expect(confirmTwoFactorLogin).toHaveBeenCalledWith("challenge", "012345");
  });

  it("allows returning from 2FA to the credentials form", async () => {
    vi.mocked(login).mockResolvedValue({ requires_2fa: true, two_fa_token: "challenge" });
    renderLogin();
    submitCredentials();
    await screen.findByLabelText("Authenticator code");
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("admin");
    expect(screen.queryByLabelText("Authenticator code")).not.toBeInTheDocument();
  });

  it("announces account lockout and makes the form available for retry", async () => {
    vi.mocked(login).mockRejectedValue({ response: { status: 423 } });
    renderLogin();
    submitCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent("Your account is temporarily locked.");
    expect(screen.getByRole("button", { name: "Sign in to workspace" })).toBeEnabled();
    expect(screen.getByLabelText("Username")).toBeEnabled();
  });
});
