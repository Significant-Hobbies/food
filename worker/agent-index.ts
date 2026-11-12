/**
 * Agent / LLM indexing surfaces (fleet GEO standard).
 * Spec: fleet-ops/docs/agent-indexing-standard.md
 *
 * Mode D: SPA + API — honest catalog + API resource markdown.
 * These routes must run via run_worker_first so SPA fallback never
 * returns HTML shells for /llms.txt or /api/ai.
 */

const ORIGIN = "https://food.significanthobbies.com";

export interface PublicProductRoute {
  id: string;
  name: string;
  brand: string;
  path: string;
  markdownPath: string;
}

export async function listPublicProductRoutes(db: D1Database): Promise<PublicProductRoute[]> {
  const result = await db
    .prepare("SELECT id, name, brand FROM products WHERE is_active = 1 ORDER BY id")
    .all<{ id: string; name: string; brand: string | null }>();
  return result.results.map(({ id, name, brand }) => {
    const encodedId = encodeURIComponent(id);
    return {
      id,
      name,
      brand: brand ?? "",
      path: `/products/${encodedId}`,
      markdownPath: `/products/${encodedId}.md`,
    };
  });
}

export async function isActivePublicProduct(db: D1Database, id: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS active FROM products WHERE id = ? AND is_active = 1")
    .bind(id)
    .first<{ active: number }>();
  return row?.active === 1;
}

export const LLMS_TXT = `# Food

> Source-aware catalog of Indian food products. Separates verified label
> evidence from broader discovery data. Does not claim complete coverage of
> the Indian market.

The human UI is a React SPA. Agents should use the API and markdown surfaces
below — do not scrape the empty client shell.

## Product

- [Catalog UI](${ORIGIN}/): Human browse / compare experience (SPA)
- [Recipes](${ORIGIN}/recipes): Source-linked vegetarian recipes
- [Recipe JSON](${ORIGIN}/api/recipes): Search the curated collection
- [Data quality](${ORIGIN}/api/data-quality): Snapshot quality and limitations
- [This index](${ORIGIN}/llms.txt): Agent entrypoint
- [Agent catalog](${ORIGIN}/api/ai): Machine-readable surface list
- [Homepage markdown](${ORIGIN}/index.md): Product brief without JS

## API (JSON)

- [Health](${ORIGIN}/api/health): Product count and publication status
- [Coverage](${ORIGIN}/api/coverage): Completion / evidence coverage
- [Search products](${ORIGIN}/api/products): Query catalog (\`q\`, filters)
- [Product detail](${ORIGIN}/products/:id): Canonical crawlable product page
- [Product markdown](${ORIGIN}/products/:id.md): Equivalent product markdown
- [Product JSON](${ORIGIN}/api/products/:id): Existing public API projection

## Optional

- [Foundry](https://sassmaker.com): Parent fleet showcase
- [GitHub](https://github.com/Significant-Hobbies/food): Source
`;

export const INDEX_MD = `# Food

Source-aware catalog of Indian food products for comparing protein foods with
**verified label evidence** separated from broader discovery data.

## What it is

- Canonical products with GTIN-oriented identity
- Source-aware nutrition, offers, ratings, and confidence
- Operator review queues for entity resolution and nutrition conflicts
- Explicit about incomplete market coverage

## Who it's for

- Indian shoppers comparing protein foods
- Operators reviewing or correcting product evidence

## Not claims

- Not a complete Indian-market census
- Not medical advice
- Does not invent missing nutrition

## Agent entrypoints

| Surface | URL |
| --- | --- |
| LLM index | ${ORIGIN}/llms.txt |
| Agent catalog | ${ORIGIN}/api/ai |
| Health | ${ORIGIN}/api/health |
| Search | ${ORIGIN}/api/products |
| Product HTML | ${ORIGIN}/products/:id |
| Product MD | ${ORIGIN}/products/:id.md |

Prefer JSON APIs or product markdown over the SPA HTML shell.
`;

export function buildApiAiCatalog(products: PublicProductRoute[], origin = ORIGIN) {
  return {
    name: "Food",
    version: "1",
    url: origin,
    llms: `${origin}/llms.txt`,
    llmsFull: null,
    sitemap: `${origin}/sitemap.xml`,
    markdown: { suffix: ".md", negotiation: true },
    surfaces: [
      { id: "recipes", url: `${origin}/api/recipes`, md: null, kind: "api", description: "Curated vegetarian recipes; publisher-stated serving macros" },
      { id: "data-quality", url: `${origin}/api/data-quality`, md: null, kind: "api", description: "Source snapshot quality, attribution and limitations" },
      {
        id: "home",
        url: `${origin}/`,
        md: `${origin}/index.md`,
        kind: "spa",
        description: "Human SPA shell — use markdown/API instead",
      },
      {
        id: "llms",
        url: `${origin}/llms.txt`,
        md: null,
        kind: "static",
        description: "Agent index",
      },
      {
        id: "health",
        url: `${origin}/api/health`,
        md: null,
        kind: "api",
      },
      {
        id: "coverage",
        url: `${origin}/api/coverage`,
        md: null,
        kind: "api",
      },
      {
        id: "products_search",
        url: `${origin}/api/products`,
        md: null,
        kind: "api",
        description: "Search/list products as JSON",
      },
      ...products.map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        url: `${origin}${product.path}`,
        md: `${origin}${product.markdownPath}`,
        json: `${origin}/api/products/${encodeURIComponent(product.id)}`,
        kind: "product" as const,
      })),
    ],
    auth: {
      public: true,
      notes:
        "Catalog read APIs are public. Review mutations are local/operator-only and denied in production.",
    },
  };
}

export function buildSitemapXml(products: PublicProductRoute[], origin = ORIGIN): string {
  const urls = ["/", "/recipes", "/sources", ...products.map((product) => product.path)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((path) => `  <url><loc>${origin}${path}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function productIdentity(product: Record<string, unknown>, origin: string) {
  const id = String(product.id ?? product.product_id ?? "");
  return {
    id,
    name: String(product.name ?? product.product_name ?? "Product"),
    brand: product.brand ? String(product.brand) : "",
    gtin: product.gtin ? String(product.gtin) : "",
    path: `/products/${encodeURIComponent(id)}`,
    origin,
  };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metricValue(value: unknown): unknown {
  return object(value).value ?? null;
}

function displayValue(value: unknown, unit: string): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value} ${unit}` : "Not available";
}

/**
 * Format a product detail record as agent-readable markdown.
 * Tolerates partial shapes from getProductDetail.
 */
export function productToMarkdown(product: Record<string, unknown>, origin = ORIGIN): string {
  const identity = productIdentity(product, origin);
  const nutrition = object(product.nutrition ?? product.verified_nutrition);
  const metrics = object(product.metrics);
  const facts = [
    ["Protein", nutrition.proteinGrams, "g"],
    ["Carbohydrate", nutrition.carbohydrateGrams, "g"],
    ["Fat", nutrition.fatGrams, "g"],
    ["Fibre", nutrition.fibreGrams, "g"],
    ["Calories", nutrition.calories, "kcal"],
    ["Protein per 100 kcal", metricValue(metrics.proteinPer100Calories), "g"],
  ] as const;

  const lines = [
    `# ${identity.name}`,
    "",
    identity.brand ? `**Brand:** ${identity.brand}` : null,
    identity.gtin ? `**GTIN:** ${identity.gtin}` : null,
    identity.id ? `**ID:** ${identity.id}` : null,
    "",
    `Canonical URL: ${origin}${identity.path}`,
    `JSON: ${origin}/api/products/${encodeURIComponent(identity.id)}`,
    "",
  ].filter((x) => x != null) as string[];

  lines.push("## Macro comparison", "");
  for (const [label, value, unit] of facts) lines.push(`- **${label}:** ${displayValue(value, unit)}`);

  lines.push(
    "",
    "## Evidence notes",
    "",
    `- Nutrition evidence: ${String(product.nutritionStatus ?? "missing")}`,
    `- Ingredient evidence: ${String(product.ingredientStatus ?? "missing")}`,
    "- Prefer verified label evidence fields over discovery-only sources.",
    "- Missing values were not provided by the source. Do not invent numbers.",
    ""
  );

  return lines.join("\n");
}

export function productToHtml(product: Record<string, unknown>, origin = ORIGIN): string {
  const identity = productIdentity(product, origin);
  const canonical = `${origin}${identity.path}`;
  const nutrition = object(product.nutrition ?? product.verified_nutrition);
  const metrics = object(product.metrics);
  const description = `${identity.brand ? `${identity.brand} ` : ""}${identity.name}: public macro and protein-density summary from Food.`;
  const facts = [
    ["Protein", nutrition.proteinGrams, "g"],
    ["Carbohydrate", nutrition.carbohydrateGrams, "g"],
    ["Fat", nutrition.fatGrams, "g"],
    ["Fibre", nutrition.fibreGrams, "g"],
    ["Calories", nutrition.calories, "kcal"],
    ["Protein / 100 kcal", metricValue(metrics.proteinPer100Calories), "g"],
  ] as const;
  const basis = nutrition.basis === "per_100g" ? "per 100 g" : nutrition.basis === "per_100ml" ? "per 100 ml" : "basis not recorded";
  const observation = typeof nutrition.observedAt === "string" && Number.isFinite(Date.parse(nutrition.observedAt)) ? nutrition.observedAt.slice(0, 10) : "not recorded";
  const sourceCandidates = [product.nutritionEvidenceUrl, ...(Array.isArray(product.sourceRecords) ? product.sourceRecords.map((record) => object(record).sourceUrl) : [])];
  let sourceUrl: string | null = null;
  let sourceLabel = "View nutrition evidence";
  for (const [index, value] of sourceCandidates.entries()) {
    try {
      const source = new URL(String(value ?? ""));
      if (source.protocol !== "https:" || source.username || source.password) continue;
      sourceUrl = source.href;
      if (index > 0) sourceLabel = "View source record (does not verify nutrition)";
      break;
    } catch { /* Try the next retained source. */ }
  }
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: identity.name,
    brand: identity.brand ? { "@type": "Brand", name: identity.brand } : undefined,
    gtin: identity.gtin || undefined,
    url: canonical,
  }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(identity.name)} · Food</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="Food">
<meta property="og:title" content="${escapeHtml(identity.name)} · Food">
<meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}">
<script type="application/ld+json">${jsonLd}</script>
<style>:root{color:#1b252b;background:#f4f5f6;font-family:system-ui,sans-serif}*{box-sizing:border-box}body{margin:0}a{color:#925000;text-underline-offset:3px}a:focus-visible{outline:3px solid #b57924;outline-offset:3px}.shell{width:min(920px,calc(100% - 40px));margin:auto;padding:30px 0 64px}.brand{display:block;padding:20px 24px;background:#19242b;color:white;text-decoration:none;font-size:24px;font-weight:750}.mark{display:none}.crumb{margin:34px 0 12px;color:#52606b;font-size:13px}h1{max-width:28ch;margin:0;font-size:clamp(28px,5vw,44px);font-weight:650;line-height:1.15;letter-spacing:-.035em;overflow-wrap:anywhere}.meta{color:#52606b;font-size:14px;line-height:1.6}.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:30px 0;background:white;border:1px solid #d7dde1}.fact{min-width:0;padding:20px;border-bottom:1px solid #d7dde1}.fact span,.state span{display:block;color:#52606b;font-size:12px}.fact strong{display:block;margin-top:8px;font-size:22px;font-weight:550;font-variant-numeric:tabular-nums}.evidence{display:grid;grid-template-columns:1fr 1fr;gap:20px}.state{padding:18px;background:#e9edef}.state strong{display:block;margin-top:6px;font-size:14px}.note{max-width:75ch;margin-top:28px;color:#52606b;line-height:1.7;font-size:13px}@media(max-width:640px){.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.evidence{grid-template-columns:1fr}.fact{padding:18px 14px}}</style>
</head><body><main class="shell">
<a class="brand" href="/"><span class="mark" aria-hidden="true">F</span><span>Food</span></a>
<p class="crumb"><a href="/">Foods</a> / Product record</p><h1>${escapeHtml(identity.name)}</h1>
<p class="meta">${identity.brand ? `${escapeHtml(identity.brand)} · ` : ""}${identity.gtin ? `GTIN ${escapeHtml(identity.gtin)}` : "Canonical product"}</p>
<p class="meta">Nutrition ${escapeHtml(basis)} · observed ${escapeHtml(observation)}. ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceLabel)}</a>` : "Original source link unavailable."}</p>
<section class="facts" aria-label="Macro comparison">${facts.map(([label, value, unit]) => `<div class="fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(displayValue(value, unit))}</strong></div>`).join("")}</section>
<section class="evidence" aria-label="Evidence state"><div class="state"><span>Nutrition evidence</span><strong>${escapeHtml(product.nutritionStatus ?? "missing")}</strong></div><div class="state"><span>Ingredient evidence</span><strong>${escapeHtml(product.ingredientStatus ?? "missing")}</strong></div></section>
<p class="note">Discovery values remain visibly distinct from Trusted evidence. Missing values are not estimates. <a href="${escapeHtml(identity.path)}.md">Read the Markdown version</a> or <a href="/api/products/${encodeURIComponent(identity.id)}">view JSON</a>.</p>
</main></body></html>`;
}
