import { env, exports } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { FOOD_BROWSER_ANALYTICS, FOOD_PUBLIC_HTML_HEADERS } from "../shared/browser-analytics";
import { FOOD_CAPTURE_LOADER, FOOD_FOOTER_ID, FOOD_FOOTER_RUNTIME } from "../shared/capture-footer";
import handler from "../worker/index";

const worker = exports.default;

async function productPath(): Promise<string> {
  const product = await env.DB.prepare("SELECT id FROM products WHERE is_active = 1 ORDER BY id LIMIT 1").first<{ id: string }>();
  if (!product) throw new Error("Expected an active product");
  return `/products/${encodeURIComponent(product.id)}`;
}

describe("Worker-rendered product analytics", () => {
  it("installs the session-only tracker in the actual canonical HTML response", async () => {
    const response = await worker.fetch(`https://food.significanthobbies.com${await productPath()}?q=private-query`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('src="https://health.sassmaker.com/tracker.js"');
    expect(html).toContain('data-identity="session"');
    expect(html).not.toContain("private-query");
    expect(html.match(/src="https:\/\/health\.sassmaker\.com\/tracker\.js"/g)).toHaveLength(1);
    expect(html).toContain(`id="${FOOD_FOOTER_ID}"`);
    expect(html).toContain(`src="${FOOD_CAPTURE_LOADER}"`);
    expect(html).toContain(`data-food-footer-runtime="${FOOD_FOOTER_RUNTIME}"`);
    expect(html).toContain('data-subscribe=""');
    expect(html).toContain('data-feedback=""');
    expect(html).toContain(`data-key="${FOOD_BROWSER_ANALYTICS.publicKey}"`);
    expect(html).toContain(`data-project="${FOOD_BROWSER_ANALYTICS.project}"`);
    expect(html).toContain(`data-endpoint="${FOOD_BROWSER_ANALYTICS.endpoint}"`);
    expect(html).toMatch(/<script[^>]+\sasync\s[^>]*src=/);
    for (const [name, value] of Object.entries(FOOD_PUBLIC_HTML_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("keeps QA product HTML silent and uncacheable", async () => {
    const response = await worker.fetch(`https://food.significanthobbies.com${await productPath()}?fleet_qa=1`);
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("health.sassmaker.com/tracker.js");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-edge-cache")).toBeNull();
  });

  it.each([
    "http://localhost",
    "http://127.0.0.1",
    "https://food-preview.example.com",
    "https://food.significanthobbies.com.example.com",
    "http://food.significanthobbies.com",
  ])("omits tracker credentials from actual product HTML outside the canonical origin: %s", async (origin) => {
    const response = await worker.fetch(`${origin}${await productPath()}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).not.toContain(FOOD_BROWSER_ANALYTICS.script);
    expect(html).not.toContain(FOOD_BROWSER_ANALYTICS.publicKey);
    expect(html).not.toContain(FOOD_FOOTER_ID);
  });

  it("keeps Markdown, JSON and Hono error responses free of browser tracking", async () => {
    const path = await productPath();
    // /operator here checks Hono's 404, not the production ASSETS-served SPA.
    // The SPA guard has browser unit coverage; local ASSETS 200/CSP was verified separately.
    for (const [route, status] of [[`${path}.md`, 200], [`/api${path}`, 200], [`/api${path}.md`, 200], ["/products/food-missing-product", 404], ["/operator", 404]] as const) {
      const response = await worker.fetch(`${FOOD_BROWSER_ANALYTICS.origin}${route}`);
      expect(response.status).toBe(status);
      const body = await response.text();
      expect(body).not.toContain(FOOD_BROWSER_ANALYTICS.script);
      expect(body).not.toContain(FOOD_BROWSER_ANALYTICS.publicKey);
      expect(body).not.toContain(FOOD_FOOTER_ID);
    }
  });

  it("bypasses an existing QA cache entry and never overwrites ordinary public HTML", async () => {
    const url = `${FOOD_BROWSER_ANALYTICS.origin}${await productPath()}?analytics-cache-case=1`;
    const qaUrl = `${url}&fleet_qa=0&fleet_qa=1`;
    const cache = (caches as unknown as { default: Cache }).default;
    await cache.delete(new Request(url));
    await cache.put(new Request(qaUrl), new Response("stale tracked QA HTML", { headers: { "Cache-Control": "public, max-age=300" } }));
    const fetchAndWait = async (address: string) => {
      const ctx = createExecutionContext();
      const response = await handler.fetch(new Request(address) as Parameters<typeof handler.fetch>[0], env, ctx);
      await waitOnExecutionContext(ctx);
      return response;
    };
    try {
      const qaBefore = await fetchAndWait(qaUrl);
      expect(qaBefore.headers.get("x-edge-cache")).toBeNull();
      expect(qaBefore.headers.get("cache-control")).toBe("no-store");
      expect(await qaBefore.text()).not.toContain(FOOD_BROWSER_ANALYTICS.publicKey);
      expect(await cache.match(new Request(url))).toBeUndefined();
      const normal = await fetchAndWait(url);
      expect(normal.headers.get("x-edge-cache")).toBe("MISS");
      expect(await normal.text()).toContain(FOOD_BROWSER_ANALYTICS.script);
      const qaAfter = await fetchAndWait(qaUrl);
      expect(qaAfter.headers.get("cache-control")).toBe("no-store");
      expect(await qaAfter.text()).not.toContain(FOOD_BROWSER_ANALYTICS.publicKey);
      expect(await (await cache.match(new Request(qaUrl)))?.text()).toBe("stale tracked QA HTML");
      const cached = await fetchAndWait(url);
      expect(cached.headers.get("x-edge-cache")).toBe("HIT");
      expect(await cached.text()).toContain(FOOD_BROWSER_ANALYTICS.script);
      expect(cached.headers.get("content-security-policy")).toBe(FOOD_PUBLIC_HTML_HEADERS["Content-Security-Policy"]);
    } finally {
      const versioned = new URL(url);
      versioned.searchParams.set("__food_html_release", env.CF_VERSION_METADATA?.id ?? "unversioned");
      await cache.delete(new Request(versioned));
      await cache.delete(new Request(url));
      await cache.delete(new Request(qaUrl));
    }
  });

  it("partitions product HTML cache entries by deployed Worker version", async () => {
    const url = `${FOOD_BROWSER_ANALYTICS.origin}${await productPath()}?capture-cache-version=1`;
    const cache = (caches as unknown as { default: Cache }).default;
    const keys = [new Request(url)];
    const fetchRelease = async (id: string) => {
      const key = new URL(url);
      key.searchParams.set("__food_html_release", id);
      keys.push(new Request(key));
      const ctx = createExecutionContext();
      const response = await handler.fetch(new Request(url) as Parameters<typeof handler.fetch>[0], {
        ...env, CF_VERSION_METADATA: { id, tag: "capture-cache-qa", timestamp: "2026-11-16T00:00:00.000Z" },
      }, ctx);
      await waitOnExecutionContext(ctx);
      return response;
    };
    await cache.put(new Request(url), new Response("stale unversioned HTML", { headers: { "Cache-Control": "public, max-age=300" } }));
    try {
      const first = await fetchRelease("capture-release-one");
      expect(first.headers.get("x-edge-cache")).toBe("MISS");
      expect(await first.text()).toContain(`id="${FOOD_FOOTER_ID}"`);
      expect((await fetchRelease("capture-release-one")).headers.get("x-edge-cache")).toBe("HIT");
      const next = await fetchRelease("capture-release-two");
      expect(next.headers.get("x-edge-cache")).toBe("MISS");
      expect(await next.text()).not.toContain("__food_html_release");
      expect((await fetchRelease("capture-release-two")).headers.get("x-edge-cache")).toBe("HIT");
      expect(await (await cache.match(new Request(url)))?.text()).toBe("stale unversioned HTML");
    } finally {
      for (const key of keys) await cache.delete(key);
    }
  });

});
