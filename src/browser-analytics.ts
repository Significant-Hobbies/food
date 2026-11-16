const FOOD_ORIGIN = "https://food.significanthobbies.com";
const FOOD_PROJECT = "app-import-04c661c3f97273f410f469b002a6a08e16e5acbfdb8b31355046db562d24a419";
const TRACKER_ID = "food-app-health-tracker";
export const FOOD_APP_HEALTH_PUBLIC_KEY = "ahk_pub_ef01695d96e9902ce15437678b10fbdf5be80ad744b4387af08ad415a3880d77";

export function installFoodAnalytics(publicKey: string, url: URL, target: Document): boolean {
  if (
    url.origin !== FOOD_ORIGIN
    || url.searchParams.get("fleet_qa") === "1"
    || /^\/operator(?:\/|$)/.test(url.pathname)
    || !/^ahk_pub_[a-f0-9]{64}$/.test(publicKey)
    || target.getElementById(TRACKER_ID)
  ) return false;

  try {
    const tracker = target.createElement("script");
    tracker.id = TRACKER_ID;
    tracker.src = "https://health.sassmaker.com/tracker.js";
    tracker.async = true;
    tracker.dataset.key = publicKey;
    tracker.dataset.project = FOOD_PROJECT;
    tracker.dataset.identity = "session";
    tracker.dataset.endpoint = "https://ingest.sassmaker.com/v1/browser";
    target.head.appendChild(tracker);
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installFoodAnalytics(FOOD_APP_HEALTH_PUBLIC_KEY, new URL(window.location.href), document);
}
