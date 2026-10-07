import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enableBiometricLogin,
  disableBiometricLogin,
  syncBiometricLogin,
  getBiometricUserId,
  getBiometricSecret,
  isMedianApp,
} from "./biometricService";

/** A stand-in for the Median bridge's secure storage. */
function installFakeMedian() {
  const store: { secret: string | null } = { secret: null };
  const auth = {
    status: vi.fn(async () => ({ hasTouchId: true, hasSecret: store.secret !== null, biometryType: "faceId" as const })),
    save: vi.fn(async ({ secret }: { secret: string }) => { store.secret = secret; return { success: true }; }),
    get: vi.fn(async (): Promise<{ success: boolean; secret?: string; error?: string }> => (store.secret ? { success: true, secret: store.secret } : { success: false })),
    delete: vi.fn(async () => { store.secret = null; return { success: true }; }),
  };
  window.median = { auth };
  return { store, auth };
}

beforeEach(() => localStorage.clear());
afterEach(() => { delete window.median; });

describe("outside the Median app", () => {
  it("reports no bridge and stores nothing", async () => {
    expect(isMedianApp()).toBe(false);
    expect(await enableBiometricLogin("u1", "rt-1")).toBe(false);
    expect(getBiometricUserId()).toBeNull();
  });
});

describe("biometric sign-in storage", () => {
  it("stores the token and remembers whose it is", async () => {
    const { store } = installFakeMedian();
    expect(await enableBiometricLogin("u1", "rt-1")).toBe(true);
    expect(store.secret).toBe("rt-1");
    expect(getBiometricUserId()).toBe("u1");
    expect(await getBiometricSecret("faceId")).toBe("rt-1");
  });

  it("does not remember the user if the phone refuses to store the token", async () => {
    const { auth } = installFakeMedian();
    auth.save.mockResolvedValueOnce({ success: false });
    expect(await enableBiometricLogin("u1", "rt-1")).toBe(false);
    expect(getBiometricUserId()).toBeNull();
  });

  it("replaces the stored token with the rotated one for the same user", async () => {
    const { store } = installFakeMedian();
    await enableBiometricLogin("u1", "rt-1");
    await syncBiometricLogin("u1", "rt-2");
    expect(store.secret).toBe("rt-2");
    expect(getBiometricUserId()).toBe("u1");
  });

  it("removes the stored token when a different account signs in", async () => {
    const { store } = installFakeMedian();
    await enableBiometricLogin("u1", "rt-1");
    await syncBiometricLogin("u2", "rt-other");
    expect(store.secret).toBeNull();
    expect(getBiometricUserId()).toBeNull();
  });

  it("does nothing on sign-in when biometric login was never turned on", async () => {
    const { auth } = installFakeMedian();
    await syncBiometricLogin("u1", "rt-1");
    expect(auth.save).not.toHaveBeenCalled();
  });

  it("turning it off deletes the token and clears flags from earlier builds", async () => {
    const { store } = installFakeMedian();
    localStorage.setItem("bio_enabled_u1", "true");
    localStorage.setItem("circle_biometric_enabled", "true");
    await enableBiometricLogin("u1", "rt-1");
    await disableBiometricLogin();
    expect(store.secret).toBeNull();
    expect(getBiometricUserId()).toBeNull();
    expect(localStorage.getItem("bio_enabled_u1")).toBeNull();
    expect(localStorage.getItem("circle_biometric_enabled")).toBeNull();
  });

  it("returns null when the prompt is cancelled and throws when the face or finger doesn't match", async () => {
    const { auth } = installFakeMedian();
    auth.get.mockResolvedValueOnce({ success: false });
    expect(await getBiometricSecret("faceId")).toBeNull();
    auth.get.mockResolvedValueOnce({ success: false, error: "authenticationFailed" });
    await expect(getBiometricSecret("faceId")).rejects.toThrow("authenticationFailed");
  });
});
