import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge, TypeBadge, VerificationBadge } from "../components/StatusBadge";
import { siteSchema } from "../schemas";

describe("StatusBadge", () => {
  it("renders each status label", () => {
    const { rerender } = render(<StatusBadge status="active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    rerender(<StatusBadge status="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    rerender(<StatusBadge status="inactive" />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("renders type and verification badges", () => {
    render(
      <div>
        <TypeBadge type="built" />
        <VerificationBadge status="verified" />
      </div>,
    );
    expect(screen.getByText("Built")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });
});

describe("siteSchema", () => {
  it("accepts a clean domain and rejects junk", () => {
    const base = { name: "X", type: "connected", integration_mode: "connector" } as const;
    expect(siteSchema.safeParse({ ...base, domain: "https://Example.com/path" }).success).toBe(true);
    expect(siteSchema.safeParse({ ...base, name: "", domain: "example.com" }).success).toBe(false);
    expect(siteSchema.safeParse({ ...base, domain: "not a domain" }).success).toBe(false);
    expect(siteSchema.safeParse({ ...base, domain: "localhost" }).success).toBe(false);
  });
});
