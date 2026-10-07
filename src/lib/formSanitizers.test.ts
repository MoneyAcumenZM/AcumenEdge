import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeName } from "./formSanitizers";

// sanitizeText must not strip quotes, semicolons, hyphens or SQL keywords:
// queries are parameterised, so stripping them would only corrupt real
// input such as "O'Brien".

describe("sanitizeText", () => {
  it("preserves an apostrophe in a legitimate name", () => {
    expect(sanitizeText("O'Brien")).toBe("O'Brien");
  });

  it("preserves a double hyphen in legitimate free text", () => {
    expect(sanitizeText("Plot 12 -- off Kabulonga Road")).toContain("--");
  });

  it("does not delete a legitimate word that happens to match a SQL keyword", () => {
    expect(sanitizeText("Select Stores Ltd")).toContain("Select");
    expect(sanitizeText("123 Update Avenue")).toContain("Update");
  });

  it("still strips HTML tags (the actual XSS defense this function provides)", () => {
    expect(sanitizeText("<script>alert(1)</script>hello")).toBe("hello");
  });

  it("still strips a javascript: URI prefix", () => {
    expect(sanitizeText("javascript:alert(1)")).not.toContain("javascript:");
  });
});

describe("sanitizeName", () => {
  it("keeps apostrophes and hyphens, which are common in real names", () => {
    expect(sanitizeName("Mary-Jane O'Connor")).toBe("Mary-Jane O'Connor");
  });
});
