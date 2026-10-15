import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import RowMenu from "./RowMenu";

afterEach(cleanup);

describe("RowMenu", () => {
  it("opens on trigger, runs actions and closes", () => {
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <RowMenu
          label="Actions"
          items={[
            { label: "Edit", to: "/websites/1/edit" },
            { label: "Delete", danger: true, dividerBefore: true, onClick: onDelete },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Actions"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(
      <MemoryRouter>
        <RowMenu label="Actions" items={[{ label: "Edit", to: "/x" }]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText("Actions"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
