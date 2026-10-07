import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIdempotencyKey } from "./useIdempotencyKey";

describe("useIdempotencyKey", () => {
  it("returns the same key for a retry of the same intent", () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const first = result.current.keyFor("buy 100 ZNCO");
    rerender();
    expect(result.current.keyFor("buy 100 ZNCO")).toBe(first);
  });

  it("starts a new key when the intent changes", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.keyFor("buy 100 ZNCO");
    expect(result.current.keyFor("buy 200 ZNCO")).not.toBe(first);
  });

  it("starts a new key for the same parameters once the previous attempt is settled", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.keyFor("buy 100 ZNCO");
    result.current.settle();
    expect(result.current.keyFor("buy 100 ZNCO")).not.toBe(first);
  });
});
