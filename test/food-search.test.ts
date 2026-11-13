// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FoodApp } from "../src/FoodApp";

let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("food search requests", () => {
  it("keeps typing responsive, waits for a pause before querying and clears immediately", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ products: [], pagination: { page: 1, pageSize: 25, total: 0, pages: 0 }, trustedDefault: false, filters: {} }));
    vi.stubGlobal("fetch", fetch);
    window.history.replaceState({}, "", "/");
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(createElement(FoodApp)));
    fetch.mockClear();
    const input = container.querySelector<HTMLInputElement>("#food-search")!;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const type = async (value: string) => act(async () => {
      set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    for (const value of ["p", "pa", "pan", "pane", "panee", "paneer"]) {
      await type(value);
      await act(async () => vi.advanceTimersByTime(30));
    }
    expect(input.value).toBe("paneer");
    expect(container.querySelector(".food-ledger")?.getAttribute("aria-busy")).toBe("true");
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(180));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("q=paneer");
    expect(container.querySelector(".food-ledger")?.getAttribute("aria-busy")).toBe("false");
    fetch.mockClear();
    await type("");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("q=&");
  });
});
