export const FOOD_BROWSER_ANALYTICS = {
  origin: "https://food.significanthobbies.com",
  project: "app-import-04c661c3f97273f410f469b002a6a08e16e5acbfdb8b31355046db562d24a419",
  publicKey: "ahk_pub_ef01695d96e9902ce15437678b10fbdf5be80ad744b4387af08ad415a3880d77",
  trackerId: "food-app-health-tracker",
  script: "https://health.sassmaker.com/tracker.js",
  endpoint: "https://ingest.sassmaker.com/v1/browser",
  identity: "session",
} as const;

export const FOOD_PUBLIC_HTML_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": `default-src 'self'; connect-src 'self' ${new URL(FOOD_BROWSER_ANALYTICS.endpoint).origin}; img-src 'self' https: data:; script-src 'self' https://static.cloudflareinsights.com ${new URL(FOOD_BROWSER_ANALYTICS.script).origin}; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
} as const;

export function isFoodAnalyticsQa(url: URL): boolean {
  return url.searchParams.getAll("fleet_qa").includes("1");
}

export function shouldInstallFoodAnalytics(url: URL): boolean {
  return url.origin === FOOD_BROWSER_ANALYTICS.origin
    && !isFoodAnalyticsQa(url)
    && !/^\/operator(?:\/|$)/.test(url.pathname);
}
