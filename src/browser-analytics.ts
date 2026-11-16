import { FOOD_BROWSER_ANALYTICS, shouldInstallFoodAnalytics } from "../shared/browser-analytics";

export function installFoodAnalytics(url: URL, target: Document): boolean {
  if (
    !shouldInstallFoodAnalytics(url)
    || target.getElementById(FOOD_BROWSER_ANALYTICS.trackerId)
  ) return false;

  try {
    const tracker = target.createElement("script");
    tracker.id = FOOD_BROWSER_ANALYTICS.trackerId;
    tracker.src = FOOD_BROWSER_ANALYTICS.script;
    tracker.async = true;
    tracker.dataset.key = FOOD_BROWSER_ANALYTICS.publicKey;
    tracker.dataset.project = FOOD_BROWSER_ANALYTICS.project;
    tracker.dataset.identity = FOOD_BROWSER_ANALYTICS.identity;
    tracker.dataset.endpoint = FOOD_BROWSER_ANALYTICS.endpoint;
    target.head.appendChild(tracker);
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installFoodAnalytics(new URL(window.location.href), document);
}
