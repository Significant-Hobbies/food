import { afterEach, describe, expect, it, vi } from "vitest";
import { observeRequest } from "../worker/telemetry";

afterEach(() => vi.unstubAllGlobals());

function context() {
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as unknown as ExecutionContext;
  return { ctx, settled: () => Promise.all(pending) };
}

describe("Food endpoint telemetry", () => {
  it("sends one normalized endpoint summary without deriving application logs", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    const execution = context();
    observeRequest(
      new Request("https://food.significanthobbies.com/api/products/private-product?search=private-query", {
        headers: { cookie: "private-cookie" },
      }),
      new Response("private-response", { status: 503 }),
      Date.now() - 10,
      { APP_HEALTH_INGEST_KEY: "fixture-ingest-key" } as unknown as Env,
      execution.ctx,
    );
    await execution.settled();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ingest.sassmaker.com/v1/ingest");
    const body = JSON.parse(String(options.body));
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toEqual({
      event_id: expect.any(String),
      timestamp: expect.any(Number),
      method: "GET",
      route: "/api/products/:id",
      status_code: 503,
      duration_ms: expect.any(Number),
    });
    expect(body.environment).toBe("production");
    expect(body.runtime).toBe("worker");
    expect(body.logs).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/private-|cookie|search|edge_cache/);
  });

  it("does nothing without a key or for an unrecognized route", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const execution = context();
    observeRequest(new Request("https://food.significanthobbies.com/"), new Response(), Date.now(), {} as Env, execution.ctx);
    observeRequest(new Request("https://food.significanthobbies.com/private-path"), new Response(), Date.now(), { APP_HEALTH_INGEST_KEY: "fixture-ingest-key" } as unknown as Env, execution.ctx);
    await execution.settled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("isolates collector failures from the product response", async () => {
    const fetch = vi.fn(async () => { throw new Error("collector unavailable"); });
    vi.stubGlobal("fetch", fetch);
    const execution = context();
    expect(() => observeRequest(new Request("https://food.significanthobbies.com/api/health?probe=private-query"), new Response("ok"), Date.now(), { APP_HEALTH_INGEST_KEY: "fixture-ingest-key" } as unknown as Env, execution.ctx)).not.toThrow();
    await expect(execution.settled()).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(options.body)).events[0].route).toBe("/api/health");
    expect(String(options.body)).not.toContain("private-query");
  });
});
