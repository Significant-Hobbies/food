// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"handleDisabledFileLoadingAsSuccess":true}}
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { installFoodAnalytics } from "../src/browser-analytics";
import { FOOD_BROWSER_ANALYTICS, FOOD_PUBLIC_HTML_HEADERS } from "../shared/browser-analytics";

const PUBLIC_KEY = FOOD_BROWSER_ANALYTICS.publicKey;

beforeEach(() => {
  document.head.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Food browser collection", () => {
  it("loads the official session-only tracker once on the canonical public site", () => {
    const url = new URL("https://food.significanthobbies.com/?search=private");
    expect(installFoodAnalytics(url, document)).toBe(true);
    expect(installFoodAnalytics(url, document)).toBe(false);
    expect(PUBLIC_KEY).toMatch(/^ahk_pub_[a-f0-9]{64}$/);
    const scripts = document.head.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe("https://health.sassmaker.com/tracker.js");
    expect(scripts[0]?.async).toBe(true);
    expect(scripts[0]?.dataset).toMatchObject({
      key: PUBLIC_KEY,
      project: "app-import-04c661c3f97273f410f469b002a6a08e16e5acbfdb8b31355046db562d24a419",
      identity: "session",
      endpoint: "https://ingest.sassmaker.com/v1/browser",
    });
    expect(document.head.innerHTML).not.toContain("private");
  });

  it.each([
    "https://food.significanthobbies.com/?fleet_qa=1",
    "https://food.significanthobbies.com/?fleet_qa=0&fleet_qa=1",
    "https://food.significanthobbies.com/operator",
    "https://food.significanthobbies.com/operator/reviews",
    "http://localhost:5173/",
    "http://localhost:5173/operator",
    "https://food-preview.example.com/",
    "https://food.significanthobbies.com.example.com/",
  ])("keeps QA, local, and non-canonical pages silent: %s", (address) => {
    expect(installFoodAnalytics(new URL(address), document)).toBe(false);
    expect(document.head.querySelector("script")).toBeNull();
  });

  it("cannot block product rendering if script installation fails", () => {
    vi.spyOn(document.head, "appendChild").mockImplementation(() => { throw new Error("script blocked"); });
    expect(installFoodAnalytics(new URL("https://food.significanthobbies.com/"), document)).toBe(false);
  });

  it("permits the installed tracker and its collector under the public content policy", () => {
    expect(installFoodAnalytics(new URL("https://food.significanthobbies.com/"), document)).toBe(true);
    const tracker = document.head.querySelector("script")!;
    const headers = readFileSync("public/_headers", "utf8");
    const value = headers.match(/^\s+Content-Security-Policy: (.+)$/m)?.[1] ?? "";
    for (const [name, header] of Object.entries(FOOD_PUBLIC_HTML_HEADERS)) {
      expect(headers).toContain(`  ${name}: ${header}`);
    }
    expect(value).toBe(FOOD_PUBLIC_HTML_HEADERS["Content-Security-Policy"]);
    const directives = new Map(value.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }));
    expect(directives.get("script-src")).toContain(new URL(tracker.src).origin);
    expect(directives.get("connect-src")).toContain(new URL(tracker.dataset.endpoint!).origin);
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("base-uri")).toEqual(["'none'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    expect(directives.get("form-action")).toEqual(["'self'"]);
    expect(value).not.toContain("'unsafe-eval'");
    expect(directives.get("script-src")).not.toContain("*");
    expect(directives.get("connect-src")).not.toContain("*");
  });
});
