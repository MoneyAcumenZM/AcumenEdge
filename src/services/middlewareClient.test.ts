import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Client = typeof import("./middlewareClient");

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Minimal stand-in for the browser WebSocket, recording what the client does with it. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
}

async function load(env: Record<string, string>): Promise<Client> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./middlewareClient");
}

const flush = () => new Promise((r) => setTimeout(r, 0));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("WebSocket", FakeSocket);
  FakeSocket.instances = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("rejects without touching the network when no API base URL is configured", async () => {
    const { middlewareClient, BACKEND_NOT_CONFIGURED } = await load({ VITE_API_BASE_URL: "" });
    await expect(middlewareClient.health()).rejects.toThrow(BACKEND_NOT_CONFIGURED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the bearer token once the auth layer has set one", async () => {
    const { middlewareClient, setApiAccessToken } = await load({ VITE_API_BASE_URL: "https://api.test/" });
    fetchMock.mockResolvedValue(jsonResponse(200, { status: "ok" }));
    setApiAccessToken("tok-123");
    await middlewareClient.health();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/health");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
  });

  it("throws an ApiError carrying the status and body of a non-2xx response", async () => {
    const { middlewareClient, ApiError } = await load({ VITE_API_BASE_URL: "https://api.test" });
    fetchMock.mockResolvedValue(jsonResponse(403, { message: "Market is closed" }));
    const err = await middlewareClient.health().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.body).toEqual({ message: "Market is closed" });
    expect(err.message).toBe("Market is closed");
  });
});

describe("placeClientOrder", () => {
  it("sends the caller's idempotency key as a header, not in the body", async () => {
    const { middlewareClient } = await load({ VITE_API_BASE_URL: "https://api.test" });
    fetchMock.mockResolvedValue(jsonResponse(200, { status: "ok", clOrdId: "C1" }));
    const order = { clientId: "u1", symbol: "ZNCO", side: "buy" as const, quantity: 100, orderType: "market" as const };
    await middlewareClient.placeClientOrder(order, "key-abc");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Idempotency-Key"]).toBe("key-abc");
    expect(JSON.parse(init.body)).toEqual(order);
  });
});

describe("csdRegister", () => {
  it("does not send a client-chosen user id", async () => {
    const { middlewareClient } = await load({ VITE_API_BASE_URL: "https://api.test" });
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, bpid: "B1" }));
    await middlewareClient.csdRegister();
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });
});

describe("order update subscription", () => {
  const env = { VITE_API_BASE_URL: "https://api.test", VITE_MIDDLEWARE_WS_URL: "wss://api.test/ws" };

  it("is a no-op when no WebSocket URL is configured", async () => {
    const { subscribeOrderUpdates } = await load({ VITE_API_BASE_URL: "https://api.test", VITE_MIDDLEWARE_WS_URL: "" });
    subscribeOrderUpdates("u1", () => {})();
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("connects with a server-issued ticket and never names a user in the subscribe frame", async () => {
    const { subscribeOrderUpdates } = await load(env);
    fetchMock.mockResolvedValue(jsonResponse(200, { ticket: "t 1" }));
    const stop = subscribeOrderUpdates("u1", () => {});
    await flush();

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/ws/ticket");
    const socket = FakeSocket.instances[0];
    expect(socket.url).toBe("wss://api.test/ws?ticket=t%201");

    socket.onopen?.();
    expect(JSON.parse(socket.sent[0])).toEqual({ type: "subscribe", channel: "orders" });
    stop();
  });

  it("opens no socket at all when a ticket can't be obtained", async () => {
    const { subscribeOrderUpdates } = await load(env);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "unauthorised" }));
    const stop = subscribeOrderUpdates("u1", () => {});
    await flush();
    expect(FakeSocket.instances).toHaveLength(0);
    stop();
  });

  it("drops frames addressed to a different user", async () => {
    const { subscribeOrderUpdates } = await load(env);
    fetchMock.mockResolvedValue(jsonResponse(200, { ticket: "t1" }));
    const received: unknown[] = [];
    const stop = subscribeOrderUpdates("u1", (d) => received.push(d));
    await flush();
    const socket = FakeSocket.instances[0];

    socket.onmessage?.({ data: JSON.stringify({ channel: "orders", userId: "someone-else", data: { status: "filled" } }) });
    socket.onmessage?.({ data: JSON.stringify({ channel: "orders", userId: "u1", data: { status: "filled" } }) });
    socket.onmessage?.({ data: "not json" });

    expect(received).toEqual([{ status: "filled" }]);
    stop();
  });
});
