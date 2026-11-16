// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"handleDisabledFileLoadingAsSuccess":true}}
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { FOOD_CAPTURE_API, FOOD_FOOTER_CSS, FOOD_FOOTER_HTML, FOOD_FOOTER_RUNTIME, foodCaptureHtml, shouldRenderFoodCapture } from "../shared/capture-footer";
import { productToHtml, productToMarkdown } from "../worker/agent-index";
import { FOOD_PUBLIC_HTML_HEADERS } from "../shared/browser-analytics";
import { activateFoodCapture } from "../shared/capture-runtime.js";

beforeEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
afterEach(() => vi.unstubAllGlobals());
beforeAll(async () => { await import("@saas-maker/ui/footer.js"); });

describe("Food public capture surfaces", () => {
  it("renders the shared consent and feedback controls under Food's canonical identity", () => {
    document.body.innerHTML = FOOD_FOOTER_HTML;
    const footer = document.querySelector("footer")!;
    const subscription = footer.querySelector<HTMLFormElement>("form[data-subscribe]")!;
    expect(footer.dataset.catalogId).toBe("protein-index");
    expect(footer.dataset.mode).toBe("light");
    expect(footer.dataset.theme).toBe("base");
    expect(subscription.dataset.catalog).toBe("protein-index");
    expect(subscription.dataset.kind).toBe("newsletter");
    expect(subscription.querySelector<HTMLInputElement>('input[name="consent"]')).toMatchObject({ checked: false, required: true });
    expect(subscription.querySelector<HTMLInputElement>('input[type="email"]')?.required).toBe(true);
    expect(footer.querySelector<HTMLFormElement>("form[data-feedback]")?.dataset.catalog).toBe("protein-index");
    expect(footer.querySelector("[data-feedback-dialog]" )?.getAttribute("aria-labelledby")).toBe("fb-title");
    expect(footer.querySelector('form[data-feedback] [name="consent"]')).toMatchObject({ checked: false, required: true });
    expect(footer.querySelector('a[href="https://sassmaker.com/privacy"]')).not.toBeNull();
    expect(footer.querySelector<HTMLButtonElement>("button[data-feedback-open]")?.disabled).toBe(true);
    expect(footer.querySelector("[data-food-capture-status]")?.textContent).toContain("need JavaScript");
    expect(footer.querySelector('form[method="get"]')).toBeNull();
    expect(FOOD_FOOTER_CSS).toContain("#995500");
    expect(FOOD_FOOTER_CSS).toContain("--display-case: none");
    expect(FOOD_FOOTER_RUNTIME).toMatch(/footer.*\.js/);
  });

  it("cannot submit email or feedback as a URL query while the runtime is loading or unavailable", () => {
    document.body.innerHTML = FOOD_FOOTER_HTML;
    const actions = new Set(FOOD_PUBLIC_HTML_HEADERS["Content-Security-Policy"].split(";").find((value) => value.trim().startsWith("form-action"))?.trim().split(/\s+/).slice(1));
    expect(actions).toEqual(new Set(["'self'"]));
    for (const form of document.querySelectorAll<HTMLFormElement>("form")) {
      expect(form.method).toBe("post");
      expect(new URL(form.action).origin).toBe(FOOD_CAPTURE_API);
      expect(new URL(form.action).origin).not.toBe("https://food.significanthobbies.com");
      expect(form.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    }
  });

  it.each([
    "https://food.significanthobbies.com/",
    "https://food.significanthobbies.com/recipes?fleet_qa=1",
    "https://food.significanthobbies.com/products/prd_public?fleet_qa=1",
  ])("allows deliberate public capture, including explicitly tagged QA: %s", (value) => {
    const url = new URL(value);
    expect(shouldRenderFoodCapture(url)).toBe(true);
    const html = foodCaptureHtml(url);
    expect(html).toContain('id="food-capture-footer"');
    expect(html).toContain('type="module"');
    expect(html).not.toContain("fleet_qa");
  });

  it.each([
    "http://localhost:5173/", "http://localhost:5173/operator", "https://food.significanthobbies.com/operator",
    "https://food.significanthobbies.com/operator/reviews", "https://food-preview.example/", "http://food.significanthobbies.com/",
  ])("does not install capture on local, operator, alias or non-HTTPS pages: %s", (value) => {
    expect(foodCaptureHtml(new URL(value))).toBe("");
  });

  it("renders the same consent controls on public product HTML without changing markdown", () => {
    const product = { id: "prd_public", name: "Public food", nutrition: { proteinGrams: 4 } };
    const html = productToHtml(product, "https://food.significanthobbies.com", new URL("https://food.significanthobbies.com/products/prd_public"));
    expect(html).toContain('data-catalog-id="protein-index"');
    expect(html).toContain('data-subscribe=""');
    expect(html).toContain('data-feedback=""');
    for (const url of ["https://world.openfoodfacts.org", "https://opendatacommons.org/licenses/odbl/1-0/", "https://github.com/Significant-Hobbies/food"]) {
      expect(html).toContain(`href="${url}"`);
    }
    expect(productToMarkdown(product)).not.toContain("data-subscribe");
  });

  it("permits only the public capture service while preserving strict operator policies", () => {
    expect(FOOD_PUBLIC_HTML_HEADERS["Content-Security-Policy"]).toContain(`connect-src 'self' https://ingest.sassmaker.com ${FOOD_CAPTURE_API};`);
    const rules = readFileSync("public/_headers", "utf8").split(/\n(?=\/)/);
    for (const rule of rules.filter((value) => value.startsWith("/operator"))) {
      expect(rule).toContain("connect-src 'self';");
      expect(rule).not.toContain(FOOD_CAPTURE_API);
    }
    expect(FOOD_PUBLIC_HTML_HEADERS["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
  });

  it("uses the actual shared runtime to block unconsented newsletter requests and preserve a feedback retry intent", async () => {
    const payloads: string[] = [];
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/capture-config/")) return Response.json({ api_key: "pk_food_test" });
      if (String(url).endsWith("/subscriptions")) return Response.json({ ok: true });
      payloads.push(String((init?.body as FormData).get("feedback")));
      if (payloads.length === 1) throw new Error("Lost response");
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetch);
    const root = document.createElement("studio-footer");
    root.innerHTML = FOOD_FOOTER_HTML;
    document.body.appendChild(root);
    activateFoodCapture(root);
    expect(root.dataset.captureReady).toBe("true");
    expect(root.querySelector("[data-food-capture-status]")?.textContent).toBe("");
    const subscribe = document.querySelector<HTMLFormElement>("form[data-subscribe]")!;
    subscribe.querySelector<HTMLInputElement>('[name="email"]')!.value = "capture-qa@example.invalid";
    subscribe.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
    subscribe.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
    subscribe.requestSubmit();
    await vi.waitFor(() => expect(subscribe.querySelector("[data-subscribe-status]")?.textContent).toBe("You're on the list."));
    const form = document.querySelector<HTMLFormElement>("form[data-feedback]")!;
    form.querySelector<HTMLInputElement>('[name="title"]')!.value = "Explicit capture QA";
    form.querySelector<HTMLTextAreaElement>('[name="message"]')!.value = "Synthetic capture acceptance only.";
    form.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
    form.requestSubmit();
    await vi.waitFor(() => expect(form.querySelector("[data-feedback-status]")?.textContent).toContain("Couldn't confirm delivery"));
    expect(form.querySelector<HTMLInputElement>('[name="title"]')!.value).toBe("Explicit capture QA");
    form.requestSubmit();
    await vi.waitFor(() => expect(payloads).toHaveLength(2));
    expect(JSON.parse(payloads[0]!)).toEqual(JSON.parse(payloads[1]!));
    expect(JSON.parse(payloads[0]!).submission_id).toMatch(/^[a-f\d-]{36}$/);
    expect(JSON.parse(payloads[0]!).page.url).not.toMatch(/[?#]/);
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/capture-config/"))).toHaveLength(1);
  });
});
