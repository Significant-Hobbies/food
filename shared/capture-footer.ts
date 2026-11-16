import { renderStudioFooterHtml } from "@saas-maker/ui/footer-html";
import footerStyles from "@saas-maker/ui/footer.css?raw";
import footerRuntime from "@saas-maker/ui/footer.js?url";
import { FOOD_BROWSER_ANALYTICS } from "./browser-analytics";

export const FOOD_CAPTURE_API = "https://api.sassmaker.com";
export const FOOD_FOOTER_RUNTIME = footerRuntime;
export const FOOD_FOOTER_ID = "food-capture-footer";
export const FOOD_FOOTER_CSS = `${footerStyles}
.food-capture-footer { --font-display: inherit; --font-text: inherit; --brand: #995500; --brand-foreground: #fff; --brand-ink: #925000; --brand-soft: #fff0d6; --background: #f4f5f6; --foreground: #1b252b; --surface: #e9edef; --card: #fff; --primary: #1b252b; --primary-foreground: #fff; --muted-foreground: #52606b; --border: #d7dde1; --input: #d7dde1; --ring: #b57924; color: #1b252b; font-family: inherit; }
footer.food-capture-footer { margin-top: 24px; padding-top: 32px; }
footer.food-capture-footer p[aria-hidden] { margin-top: 32px; font-size: clamp(40px, 7vw, 80px); text-align: left; }
.food-capture-footer form[data-feedback] input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), .food-capture-footer button[type="submit"] { min-height: 44px; }
`;

// Native fallback submissions are POSTs blocked by form-action; email must never enter a URL.
export const FOOD_FOOTER_HTML = renderStudioFooterHtml({
  product: "Food",
  url: FOOD_BROWSER_ANALYTICS.origin,
  summary: "Compare food labels on the same basis and trace each record to its source.",
  catalogId: "protein-index",
  capture: "newsletter",
  variant: "gallery",
  className: "food-capture-footer",
  groups: [{ title: "Sources", links: [
    { label: "Open Food Facts", href: "https://world.openfoodfacts.org" },
    { label: "ODbL", href: "https://opendatacommons.org/licenses/odbl/1-0/" },
    { label: "Source code", href: "https://github.com/Significant-Hobbies/food" },
  ] }],
  studio: [{ label: "Significant Hobbies", href: "https://significanthobbies.com" }],
  legal: "Food by Significant Hobbies. Packaged-food data from Open Food Facts under ODbL.",
  privacyUrl: "https://sassmaker.com/privacy",
})
  .replace('data-subscribe=""', `method="post" action="${FOOD_CAPTURE_API}/v1/subscriptions" data-subscribe=""`)
  .replace('data-feedback=""', `method="post" action="${FOOD_CAPTURE_API}/v1/feedback" data-feedback=""`);

export function shouldRenderFoodCapture(url: URL): boolean {
  return url.origin === FOOD_BROWSER_ANALYTICS.origin
    && !/^\/operator(?:\/|$)/.test(url.pathname);
}

export function foodCaptureHtml(url: URL): string {
  if (!shouldRenderFoodCapture(url)) return "";
  return `<style>${FOOD_FOOTER_CSS}</style><studio-footer id="${FOOD_FOOTER_ID}">${FOOD_FOOTER_HTML}</studio-footer><script type="module" src="${FOOD_FOOTER_RUNTIME}"></script>`;
}
