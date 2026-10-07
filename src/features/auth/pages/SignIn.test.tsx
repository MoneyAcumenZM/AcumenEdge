import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const refreshSession = vi.fn();
vi.mock("@/integrations/data/client", () => ({
  isBackendConfigured: true,
  db: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      signInWithPassword: vi.fn(),
      refreshSession: (...args: unknown[]) => refreshSession(...args),
    },
  },
}));
const logAudit = vi.fn();
vi.mock("@/lib/audit", () => ({ logAudit: (...args: unknown[]) => logAudit(...args) }));

import SignIn from "./SignIn";

const store: { secret: string | null } = { secret: null };
function installFakeMedian() {
  window.median = {
    auth: {
      status: vi.fn(async () => ({ hasTouchId: true, hasSecret: store.secret !== null, biometryType: "faceId" as const })),
      save: vi.fn(async ({ secret }: { secret: string }) => { store.secret = secret; return { success: true }; }),
      get: vi.fn(async (): Promise<{ success: boolean; secret?: string; error?: string }> => (store.secret ? { success: true, secret: store.secret } : { success: false })),
      delete: vi.fn(async () => { store.secret = null; return { success: true }; }),
    },
  };
}

const renderSignIn = () =>
  render(
    <MemoryRouter initialEntries={["/signin"]}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/" element={<p>Home screen</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => { localStorage.clear(); store.secret = null; refreshSession.mockReset(); logAudit.mockReset(); });
afterEach(() => { delete window.median; });

describe("biometric sign-in button", () => {
  it("is not shown outside the Median app", async () => {
    renderSignIn();
    await waitFor(() => expect(screen.getByText(/Sign In to Trading/)).toBeTruthy());
    expect(screen.queryByText(/Sign in with/)).toBeNull();
  });

  it("is not shown in the Median app until biometric login has been turned on", async () => {
    installFakeMedian();
    renderSignIn();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Sign in with/)).toBeNull();
  });

  it("signs in with the stored token and records the sign-in", async () => {
    installFakeMedian();
    store.secret = "rt-1";
    localStorage.setItem("acumenedge_biometric_user", "u1");
    refreshSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null });

    renderSignIn();
    fireEvent.click(await screen.findByText("Sign in with Face ID"));

    await screen.findByText("Home screen");
    expect(refreshSession).toHaveBeenCalledWith({ refresh_token: "rt-1" });
    expect(logAudit).toHaveBeenCalledWith("SIGN_IN_BIOMETRIC");
  });

  it("turns biometric login off and explains when the stored session has expired", async () => {
    installFakeMedian();
    store.secret = "rt-old";
    localStorage.setItem("acumenedge_biometric_user", "u1");
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "Invalid Refresh Token" } });

    renderSignIn();
    fireEvent.click(await screen.findByText("Sign in with Face ID"));

    expect(await screen.findByText(/Face ID sign-in has expired/)).toBeTruthy();
    expect(store.secret).toBeNull();
    expect(localStorage.getItem("acumenedge_biometric_user")).toBeNull();
    expect(screen.queryByText("Sign in with Face ID")).toBeNull();
  });
});
