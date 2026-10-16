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

describe("useIdempotencyKey with a scope", () => {
  it("survives the screen being closed and reopened", () => {
    sessionStorage.clear();
    const first = renderHook(() => useIdempotencyKey("order:u1"));
    const key = first.result.current.keyFor("buy 100 ZNCO");
    first.unmount();
    const second = renderHook(() => useIdempotencyKey("order:u1"));
    expect(second.result.current.keyFor("buy 100 ZNCO")).toBe(key);
  });

  it("is dropped by settle(), so the next identical order is a new one", () => {
    sessionStorage.clear();
    const a = renderHook(() => useIdempotencyKey("order:u1"));
    const key = a.result.current.keyFor("buy 100 ZNCO");
    a.result.current.settle();
    a.unmount();
    const b = renderHook(() => useIdempotencyKey("order:u1"));
    expect(b.result.current.keyFor("buy 100 ZNCO")).not.toBe(key);
  });

  it("does not share keys between scopes", () => {
    sessionStorage.clear();
    const a = renderHook(() => useIdempotencyKey("order:u1"));
    const b = renderHook(() => useIdempotencyKey("withdraw:u1"));
    expect(a.result.current.keyFor("x")).not.toBe(b.result.current.keyFor("x"));
  });

  it("does not reuse a key older than the retry window", () => {
    sessionStorage.setItem("idem:order:u1", JSON.stringify({ fingerprint: "x", key: "old", at: Date.now() - 31 * 60 * 1000 }));
    const a = renderHook(() => useIdempotencyKey("order:u1"));
    expect(a.result.current.keyFor("x")).not.toBe("old");
  });
});

describe("what is written to storage", () => {
  it("never contains the order or withdrawal details, only a fingerprint", () => {
    sessionStorage.clear();
    const { result } = renderHook(() => useIdempotencyKey("withdraw:u1"));
    result.current.keyFor(JSON.stringify({ method: "bank", bankAccount: "0123456789", mobileNumber: "260971234567" }));
    const stored = sessionStorage.getItem("idem:withdraw:u1") ?? "";
    expect(stored).not.toContain("0123456789");
    expect(stored).not.toContain("260971234567");
    expect(stored).toContain("fingerprint");
  });
});
