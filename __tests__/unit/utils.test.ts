import { describe, it, expect } from "vitest";
import { cn, naturalCompare } from "@/lib/utils";

describe("cn", () => {
  it("merges two class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
    expect(cn("a", undefined, "c")).toBe("a c");
    expect(cn("a", null, "c")).toBe("a c");
  });

  it("resolves conflicting Tailwind classes (last wins)", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("bg-red-500", "bg-green-500")).toBe("bg-green-500");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });

  it("handles array of class names", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("handles object syntax (clsx)", () => {
    expect(cn({ active: true, hidden: false })).toBe("active");
    expect(cn({ active: true, hidden: true })).toBe("active hidden");
  });

  it("does not duplicate non-conflicting classes", () => {
    expect(cn("flex", "items-center", "gap-2")).toBe("flex items-center gap-2");
  });
});

describe("naturalCompare", () => {
  it("sorts BSBIA01-EST9 before BSBIA01-EST10 (numeric order)", () => {
    expect(naturalCompare("BSBIA01-EST9", "BSBIA01-EST10")).toBeLessThan(0);
  });

  it("sorts BSBIA01-EST10 after BSBIA01-EST9", () => {
    expect(naturalCompare("BSBIA01-EST10", "BSBIA01-EST9")).toBeGreaterThan(0);
  });

  it("returns 0 for equal strings", () => {
    expect(naturalCompare("BSBIA01-EST01", "BSBIA01-EST01")).toBe(0);
  });

  it("sorts alphabetically when no numeric suffix", () => {
    expect(naturalCompare("abc", "abd")).toBeLessThan(0);
    expect(naturalCompare("abd", "abc")).toBeGreaterThan(0);
  });

  it("sorts a full list of notebook hostnames in natural order", () => {
    const input = ["BSBIA01-EST10", "BSBIA01-EST2", "BSBIA01-EST1", "BSBIA01-EST9"];
    const sorted = [...input].sort(naturalCompare);
    expect(sorted).toEqual([
      "BSBIA01-EST1",
      "BSBIA01-EST2",
      "BSBIA01-EST9",
      "BSBIA01-EST10",
    ]);
  });

  it("handles zero-padded numbers correctly", () => {
    const input = ["BSBIA01-EST10", "BSBIA01-EST09", "BSBIA01-EST01"];
    const sorted = [...input].sort(naturalCompare);
    // Numeric: 1, 9, 10
    expect(sorted[0]).toContain("01");
    expect(sorted[2]).toContain("10");
  });

  it("is case-insensitive", () => {
    expect(naturalCompare("abc", "ABC")).toBe(0);
  });
});
