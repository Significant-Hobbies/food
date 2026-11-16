import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, publicApi } from "../src/public-api";
import { api, TerminalEvidenceRequestError } from "../src/api";

afterEach(() => vi.unstubAllGlobals());

describe("public Food HTTP client boundary", () => {
  it("preserves catalog query, cancellation and JSON handling", async () => {
    const fetch = vi.fn(async () => Response.json({ items: [], pagination: { total: 0 } }));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    expect(await publicApi.catalog(new URLSearchParams({ q: "rice", page: "2" }), controller.signal)).toEqual({ items: [], pagination: { total: 0 } });
    expect(fetch).toHaveBeenCalledWith("/api/products?q=rice&page=2", { signal: controller.signal, headers: { "Content-Type": "application/json" } });
  });

  it("preserves product path encoding and structured failure details", async () => {
    const fetch = vi.fn(async (_path: string, _init?: RequestInit) => Response.json({ error: { code: "not_found", message: "Food record unavailable", details: { retry: false } } }, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    await expect(publicApi.product("prd/a?b")).rejects.toMatchObject({ name: "ApiRequestError", status: 404, code: "not_found", message: "Food record unavailable", details: { retry: false } });
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/products/prd%2Fa%3Fb");
    await expect(publicApi.product("missing")).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("retains the operator's terminal-evidence error classification", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "stale_evidence", message: "Evidence changed", details: { evidenceId: "evidence-qa" } } }, { status: 409 })));
    await expect(api.recordTerminalEvidence("prd-qa", {
      family: "nutrition", outcome: "not_declared", evidenceId: "evidence-qa", sourceContentHash: "a".repeat(64),
      labelContentSha256: null, idempotencyKey: "capture-client-regression", rationale: "Synthetic client regression", supersedesDecisionId: null,
    })).rejects.toBeInstanceOf(TerminalEvidenceRequestError);
  });
});
