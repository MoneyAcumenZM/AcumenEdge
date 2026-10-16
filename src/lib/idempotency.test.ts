import { describe, it, expect } from "vitest";
import { isOutcomeUnknown, errorLeavesOutcomeUnknown, ResponseShapeError } from "./idempotency";
import { ApiError } from "@/services/middlewareClient";

describe("isOutcomeUnknown", () => {
  it("keeps the key after any 5xx, because the server may have committed first", () => {
    for (const s of [500, 502, 503, 504, 599]) expect(isOutcomeUnknown(s)).toBe(true);
  });

  it("keeps the key when there was no HTTP answer at all", () => {
    expect(isOutcomeUnknown(undefined)).toBe(true);
    expect(isOutcomeUnknown(null)).toBe(true);
  });

  it("keeps the key for 4xx answers that do not prove a refusal", () => {
    for (const s of [408, 409, 425, 429]) expect(isOutcomeUnknown(s)).toBe(true);
  });

  it("releases the key for real refusals and for success", () => {
    for (const s of [200, 201, 400, 401, 402, 403, 404, 410, 422]) expect(isOutcomeUnknown(s)).toBe(false);
  });
});

describe("errorLeavesOutcomeUnknown", () => {
  it("reads the status of an ApiError", () => {
    expect(errorLeavesOutcomeUnknown(new ApiError("bad gateway", 502, null))).toBe(true);
    expect(errorLeavesOutcomeUnknown(new ApiError("market closed", 403, null))).toBe(false);
  });

  it("treats timeouts and network failures as unknown", () => {
    expect(errorLeavesOutcomeUnknown(new Error("The server took too long to respond."))).toBe(true);
    expect(errorLeavesOutcomeUnknown(new TypeError("Failed to fetch"))).toBe(true);
    expect(errorLeavesOutcomeUnknown(undefined)).toBe(true);
  });

  it("treats an unreadable 2xx answer as unknown", () => {
    expect(errorLeavesOutcomeUnknown(new ResponseShapeError("order", "status: Required"))).toBe(true);
  });
});
