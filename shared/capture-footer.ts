import { renderStudioFooterHtml } from "@saas-maker/ui/footer-html";
import footerStyles from "@saas-maker/ui/footer.css?raw";
import footerRuntime from "@saas-maker/ui/footer.js?url";
import captureLoader from "./capture-runtime.js?url&no-inline";
import { FOOD_BROWSER_ANALYTICS } from "./browser-analytics";

export const FOOD_CAPTURE_API = "https://api.sassmaker.com";
export const FOOD_FOOTER_RUNTIME = footerRuntime;
export const FOOD_CAPTURE_LOADER = captureLoader;
export const FOOD_FOOTER_ID = "food-capture-footer";
export const FOOD_FOOTER_CSS = `${footerStyles}
:where(studio-footer) footer.food-capture-footer[data-fleet-footer] { --radius: .5rem; --display-case: none; --ui-case: none; --font-display: inherit; --font-text: inherit; --brand: #995500; --brand-foreground: #fff; --brand-ink: #925000; --brand-soft: #fff0d6; --background: #f4f5f6; --foreground: #1b252b; --surface: #e9edef; --card: #fff; --primary: #1b252b; --primary-foreground: #fff; --muted-foreground: #52606b; --border: #d7dde1; --input: #d7dde1; --ring: #b57924; color: #1b252b; font-family: inherit; }
footer.food-capture-footer { --color-background: var(--background); --color-foreground: var(--foreground); --color-surface: var(--surface); --color-card: var(--card); --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground); --color-brand: var(--brand); --color-brand-foreground: var(--brand-foreground); --color-brand-ink: var(--brand-ink); --color-brand-soft: var(--brand-soft); --color-muted-foreground: var(--muted-foreground); --color-border: var(--border); --color-input: var(--input); --color-ring: var(--ring); margin-top: 0; padding-top: 0; padding-bottom: 32px; }
.food-capture-footer p[aria-hidden], .food-capture-footer > div:has(nav[aria-label="From the studio"]) { display: none; }
.food-capture-footer > div > div:has(> div.flex) { display: block; margin-top: 24px; }
.food-capture-footer [data-food-capture-status] { margin: 16px auto 0; max-width: 1088px; padding-inline: 20px; color: #52606b; font-size: 13px; }
.food-capture-footer [data-food-capture-status]:empty { display: none; }
.food-capture-footer button:disabled { opacity: .6; cursor: not-allowed; }
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
  groups: [],
  studio: [{ label: "Significant Hobbies", href: "https://significanthobbies.com" }],
  privacyUrl: "https://sassmaker.com/privacy",
})
  .replace("<footer ", '<footer data-mode="light" data-theme="base" ')
  .replace(/<form method="get" target="_blank"[\s\S]*?<\/form>/, "")
  .replace('data-subscribe=""', `method="post" action="${FOOD_CAPTURE_API}/v1/subscriptions" data-subscribe=""`)
  .replace('data-feedback=""', `method="post" action="${FOOD_CAPTURE_API}/v1/feedback" data-feedback=""`)
  .replaceAll('type="submit"', 'type="submit" disabled=""')
  .replace('data-feedback-open=""', 'data-feedback-open="" disabled=""')
  .replace("</footer>", '<p data-food-capture-status role="status">Updates and feedback need JavaScript. If these controls stay unavailable, reload this page.</p></footer>');

const ATTRIBUTION_HTML = '<footer class="food-footer"><span>Food by Significant Hobbies</span><span><a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a> · <a href="https://github.com/Significant-Hobbies/food">Source code</a></span></footer>';

export function shouldRenderFoodCapture(url: URL): boolean {
  return url.origin === FOOD_BROWSER_ANALYTICS.origin
    && !/^\/operator(?:\/|$)/.test(url.pathname);
}

export function foodCaptureHtml(url: URL): string {
  if (!shouldRenderFoodCapture(url)) return "";
  return `<style>${FOOD_FOOTER_CSS}.food-footer{width:min(1088px,calc(100% - 40px));margin:24px auto;padding:20px 0;border-top:1px solid #d7dde1;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;color:#52606b;font-size:13px}.food-footer a{color:inherit}</style>${ATTRIBUTION_HTML}<studio-footer id="${FOOD_FOOTER_ID}" data-mode="light" data-theme="base">${FOOD_FOOTER_HTML}</studio-footer><script type="module" src="${FOOD_CAPTURE_LOADER}" data-food-footer-runtime="${FOOD_FOOTER_RUNTIME}"></script>`;
}
