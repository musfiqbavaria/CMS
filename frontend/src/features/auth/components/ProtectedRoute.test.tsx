import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ProtectedRoute from "./ProtectedRoute";
import { useAuthStore } from "../../../stores/auth";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <p>login page</p> },
      { element: <ProtectedRoute />, children: [{ path: "/secret", element: <p>secret page</p> }] },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe("ProtectedRoute", () => {
  it("redirects anonymous users to /login", async () => {
    useAuthStore.getState().clearSession();
    renderAt("/secret");
    expect(await screen.findByText("login page")).toBeInTheDocument();
  });

  it("renders the page for authenticated users", async () => {
    useAuthStore.setState({ status: "authenticated", accessToken: "x", user: null });
    renderAt("/secret");
    expect(await screen.findByText("secret page")).toBeInTheDocument();
    useAuthStore.getState().clearSession();
  });
});
