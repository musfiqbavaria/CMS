import { describe, expect, it } from "vitest";
import { SECTION_TYPES, SECTION_TYPE_MAP } from "./sectionTypes";
import { moveItem } from "./components/SectionCard";

describe("section catalog", () => {
  it("covers every backend section type", () => {
    const backendTypes = [
      "hero", "features", "gallery", "testimonials", "pricing",
      "faq", "contact", "blog_list", "product_grid", "custom_html",
    ];
    expect(SECTION_TYPES.map((t) => t.type).sort()).toEqual([...backendTypes].sort());
    for (const t of backendTypes) {
      expect(SECTION_TYPE_MAP[t].fields.length).toBeGreaterThan(0);
    }
  });
});

describe("moveItem", () => {
  it("reorders without mutating", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(list, 2, 0)).toEqual(["c", "a", "b"]);
    expect(list).toEqual(["a", "b", "c"]);
  });
});
