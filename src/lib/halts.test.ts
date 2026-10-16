import { describe, it, expect } from "vitest";
import { checkHalt } from "./halts";

describe("checkHalt", () => {
  it("blocks a halted symbol, whatever its case or spacing", () => {
    const status = { halted_symbols: ["ZNCO"], halts_known: true };
    for (const s of ["ZNCO", "znco", " ZnCo "]) {
      const r = checkHalt(status, s);
      expect(r.blocked).toBe(true);
      if (r.blocked) expect(r.reason).toBe("halted");
    }
  });

  it("lets other symbols through", () => {
    expect(checkHalt({ halted_symbols: ["ZNCO"], halts_known: true }, "SHOP").blocked).toBe(false);
  });

  it("blocks everything when the halts feed could not be read", () => {
    const r = checkHalt({ halted_symbols: [], halts_known: false }, "SHOP");
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.reason).toBe("unknown");
  });

  it("does not block on a status that has not loaded yet or a missing symbol", () => {
    expect(checkHalt(undefined, "SHOP").blocked).toBe(false);
    expect(checkHalt({ halts_known: false }, "").blocked).toBe(false);
  });
});
