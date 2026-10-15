import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge, Button, CopyButton, EmptyState, PageHeader, timeAgo } from "./kit";

describe("kit", () => {
  it("renders button variants and page headers", () => {
    render(
      <div>
        <PageHeader title="Sites" description="Manage all sites" actions={<Button variant="primary">Add</Button>} />
      </div>,
    );
    expect(screen.getByText("Sites")).toBeInTheDocument();
    expect(screen.getByText("Manage all sites")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  it("renders badges and empty states", () => {
    render(
      <div>
        <Badge tone="green">verified</Badge>
        <EmptyState title="Nothing here" hint="Create one to begin." />
      </div>,
    );
    expect(screen.getByText("verified")).toBeInTheDocument();
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("explains how to copy manually when the clipboard API is unavailable", async () => {
    render(<CopyButton text="hello" />);
    fireEvent.click(screen.getByText("Copy"));
    expect(await screen.findByText("Copy manually")).toHaveAttribute("aria-live", "polite");
  });

  it("formats relative times", () => {
    expect(timeAgo(null)).toBe("—");
    expect(timeAgo(new Date(Date.now() - 5 * 60 * 1000).toISOString())).toBe("5m ago");
    expect(timeAgo(new Date(Date.now() - 3 * 3600 * 1000).toISOString())).toBe("3h ago");
  });
});
