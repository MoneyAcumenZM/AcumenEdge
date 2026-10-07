import { describe, it, expect } from "vitest";
import { asRecord, asRecords, asString, asNumber, errorMessage } from "./apiShape";

describe("asRecord / asRecords", () => {
  it("passes plain objects through", () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it("turns anything that isn't a plain object into an empty record", () => {
    for (const v of [null, undefined, "x", 5, true, [1, 2]]) expect(asRecord(v)).toEqual({});
  });

  it("turns anything that isn't an array into an empty list", () => {
    for (const v of [null, undefined, "x", 5, { orders: [] }]) expect(asRecords(v)).toEqual([]);
  });

  it("replaces non-object array entries rather than letting them through", () => {
    expect(asRecords([{ symbol: "ZNCO" }, null, "junk"])).toEqual([{ symbol: "ZNCO" }, {}, {}]);
  });
});

describe("asString / asNumber", () => {
  it("stringifies finite numbers and falls back otherwise", () => {
    expect(asString("filled")).toBe("filled");
    expect(asString(12)).toBe("12");
    expect(asString(undefined, "?")).toBe("?");
    expect(asString({}, "?")).toBe("?");
    expect(asString(NaN, "?")).toBe("?");
  });

  it("returns null instead of NaN for missing or non-numeric values", () => {
    expect(asNumber("4.85")).toBe(4.85);
    expect(asNumber(0)).toBe(0);
    for (const v of [null, undefined, "", "abc", NaN, Infinity]) expect(asNumber(v)).toBeNull();
  });
});

describe("errorMessage", () => {
  it("reads the message from Errors, strings and error-shaped objects", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("plain")).toBe("plain");
    expect(errorMessage({ message: "from api" })).toBe("from api");
  });

  it("uses the fallback when there is nothing usable", () => {
    expect(errorMessage(null, "fallback")).toBe("fallback");
    expect(errorMessage({ message: 42 }, "fallback")).toBe("fallback");
    expect(errorMessage(new Error(""), "fallback")).toBe("fallback");
  });
});
