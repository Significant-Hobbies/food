import { useDeferredValue, useEffect, useState } from "react";
import { Button } from "@saas-maker/ui/atoms/button";
import { Input } from "@saas-maker/ui/atoms/input";
import { CatalogTable, ProductDrawer } from "./App";
import { api } from "./api";
import { CATALOG_SORTS, defaultSortOrder, isCatalogSort, nextSortOrder, type CatalogSort, type SortOrder } from "../shared/catalog-sort";
import { Recipes } from "./Recipes";
import type { CatalogResponse, ProductDetailResponse } from "../shared/api";

type View = "foods" | "recipes" | "sources";
type Filters = { q: string; category: string; scope: string; sort: CatalogSort; order: SortOrder };
type Quality = {
  source: string; sourceUpdatedAt: string; preparedAt: string;
  recordsRead: number; indiaRecords: number; stagedRecords: number; excludedRecords: number;
  canonicalProducts: number; usableNutrition: number; completeCoreMacros: number; withIngredients: number;
  nutritionConflicts: number; missingNutrition: number; withLabelImage: number;
  duplicateBarcodes: number; kilojouleConversions: number; sourceErrors: number;
  downloadPath: string; limitations: string[];
  labelSpotChecks: Array<{ code: string; sourceUrl: string; result: string; note: string }>;
};

function currentView(): View {
  return window.location.pathname === "/recipes" ? "recipes" : window.location.pathname === "/sources" ? "sources" : "foods";
}

function readFilters(): Filters {
  const query = new URLSearchParams(window.location.search);
  const rawSort = query.get("sort") ?? "protein_density";
  const sort = isCatalogSort(rawSort) ? rawSort : "protein_density";
  const rawOrder = query.get("order");
  const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : defaultSortOrder(sort);
  return { q: query.get("q") ?? "", category: query.get("category") ?? "all", scope: query.get("scope") ?? "all", sort, order };
}

function Sources() {
  const [quality, setQuality] = useState<Quality | null>(null);
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    fetch("/api/data-quality").then(async (response) => {
      if (!response.ok) throw new Error("Quality report unavailable");
      setQuality(await response.json() as Quality);
    }).catch(() => setError(true));
  };
  useEffect(load, []);
  return <section className="sources-page">
    <h1>Know what’s behind the numbers.</h1>
    <p className="lede">Nutrition from Open Food Facts and recipes from their original publishers. Source links, observation dates and data checks are available below.</p>
    {error && <div className="food-error" role="alert"><p>The quality report could not be loaded.</p><Button variant="outline" onClick={load}>Try again</Button></div>}
    {!quality && !error && <p role="status">Loading the snapshot report…</p>}
    {quality && <>
      <dl className="source-meta"><div><dt>Food source</dt><dd><a href="https://world.openfoodfacts.org/data" target="_blank" rel="noreferrer">Open Food Facts bulk export</a></dd></div><div><dt>Latest source edit</dt><dd>{quality.sourceUpdatedAt.slice(0, 10)}</dd></div><div><dt>Prepared snapshot</dt><dd>{quality.preparedAt.slice(0, 10)}</dd></div><div><dt>Scope</dt><dd>Products tagged as sold in India</dd></div></dl>
      <h2>What the snapshot contains</h2>
      <div className="table-wrap"><table className="quality-table"><thead><tr><th>Check</th><th>Records</th><th>What it means</th></tr></thead><tbody>{[
        ["Global rows in snapshot", quality.recordsRead, "The source Parquet metadata row count; all India-tagged rows were queried."],
        ["India-tagged source rows", quality.indiaRecords, "Country tags are contributor-provided; they do not prove current availability."],
        ["Accepted source records", quality.stagedRecords, "Named records retained with their original source and observations."],
        ["Excluded source rows", quality.excludedRecords, "Missing identity, obsolete or duplicate source records, with reasons retained."],
        ["Canonical products", quality.canonicalProducts, "GTIN matching deduplicates source records. Ambiguous identity is not silently merged."],
        ["Usable calories + protein", quality.usableNutrition, "Positive calories and protein present, after numeric conflict checks."],
        ["Five core macros present", quality.completeCoreMacros, "Calories, protein, carbohydrate, fat and fibre are recorded; quality is separate from completeness."],
        ["Ingredient statements", quality.withIngredients, "Source-provided text, not an allergen guarantee."],
        ["Nutrition conflicts", quality.nutritionConflicts, "Failed numeric or source quality checks. Withheld from protein rankings."],
        ["Nutrition missing", quality.missingNutrition, "Neither calories nor protein is recorded. Missing is never converted to zero."],
        ["Nutrition label images", quality.withLabelImage, "A source image link exists. Presence does not establish a match or verification."],
        ["kJ conversions", quality.kilojouleConversions, "Calories derived only when kcal is absent, using 1 kcal = 4.184 kJ."],
      ].map(([label, count, meaning]) => <tr key={String(label)}><th scope="row">{label}</th><td>{Number(count).toLocaleString("en-IN")}</td><td>{meaning}</td></tr>)}</tbody></table></div>
      <h2>Selected label spot checks</h2><p>Three selected examples were visually compared with their source images. This is not a random sample or a catalog-wide accuracy estimate. Flagged records remain conflicts; no record was promoted to human-verified.</p><ul className="source-limits">{quality.labelSpotChecks.map((check) => <li key={check.code}><a href={check.sourceUrl} target="_blank" rel="noreferrer">{check.code}</a> · {check.result.replaceAll("_", " ")}. {check.note}</li>)}</ul>
      <h2>Limits to keep in mind</h2><ul className="source-limits">{quality.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
      <p><a href={quality.downloadPath} download>Download the attributed food snapshot</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Database License</a>. Product images have separate rights, including Open Food Facts’ <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA</a> terms.</p>
    </>}
    <h2>Recipes are a separate collection</h2><p>50 egg-free vegetarian recipes from 14 original publishers, collected on 15 August 2026. Nutrition is the publisher’s estimate for its stated serving. Food labels use a per-100-g or per-100-ml basis; recipe servings are not treated as the same portion. Read the original recipe for instructions and current details.</p>
    <p><a href="/data/recipe-video-archive.json" download>Download the retained video-recipe archive</a>. This historical collection is separate from the 50 curated recipes and their admission criteria.</p>
  </section>;
}

export function FoodApp() {
  const [view, setView] = useState<View>(currentView);
  const [filters, setFilters] = useState<Filters>(readFilters);
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDetailResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const query = useDeferredValue(filters.q);
  const navigate = (next: View) => {
    setView(next);
    window.history.pushState({}, "", next === "foods" ? "/" : `/${next}`);
    if (next === "foods") { setFilters(readFilters()); setPage(1); }
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const sync = () => { setView(currentView()); setFilters(readFilters()); setPage(1); setSelected(null); };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    document.title = view === "recipes" ? "Vegetarian recipes · Food" : view === "sources" ? "Data & sources · Food" : "Food · Significant Hobbies";
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", `https://food.significanthobbies.com${view === "foods" ? "/" : `/${view}`}`);
  }, [view]);
  const changeFilters = (next: Partial<Filters>) => {
    const value = { ...filters, ...next };
    setFilters(value); setPage(1);
    const search = new URLSearchParams();
    for (const [key, item] of Object.entries(value)) if (item && item !== "all") search.set(key, item);
    window.history.replaceState({}, "", `/${search.size ? `?${search}` : ""}`);
  };
  useEffect(() => {
    if (view !== "foods") return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    const params = new URLSearchParams({ ...filters, q: query, trust: "all", verification: "all", ingredientVerification: "all", page: String(page), pageSize: "25" });
    api.catalog(params, controller.signal).then((result) => { if (controller.signal.aborted) return; setCatalog(result); setLoading(false); })
      .catch((reason: unknown) => { if (controller.signal.aborted) return; setError(reason instanceof Error ? reason.message : "Food data could not be loaded."); setLoading(false); });
    return () => controller.abort();
  }, [query, filters.category, filters.scope, filters.sort, filters.order, page, retry, view]);
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    const controller = new AbortController();
    setDetail(null); setDetailError(null); setDetailLoading(true);
    api.product(selected, controller.signal).then((value) => { if (controller.signal.aborted) return; setDetail(value); setDetailLoading(false); })
      .catch((reason: unknown) => { if (controller.signal.aborted) return; setDetailError(reason instanceof Error ? reason.message : "Product could not be loaded."); setDetailLoading(false); });
    return () => controller.abort();
  }, [selected]);
  const displayedSort = isCatalogSort(String(catalog?.filters.sort)) ? catalog!.filters.sort as CatalogSort : filters.sort;
  const displayedOrder = catalog?.filters.order === "asc" ? "asc" : "desc";
  return <div className="food-app">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="food-topbar"><a className="food-wordmark" href="/" onClick={(event) => { event.preventDefault(); navigate("foods"); }}>Food /</a><nav aria-label="Main navigation">{(["foods", "recipes", "sources"] as const).map((item) => <a key={item} href={item === "foods" ? "/" : `/${item}`} aria-current={view === item ? "page" : undefined} onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(item); }}>{item === "foods" ? "Foods" : item === "recipes" ? "Recipes" : "Data & sources"}</a>)}</nav><a className="food-family" href="https://significanthobbies.com">Significant Hobbies</a></header>
    <main id="main" className="food-main">
      {view === "foods" && <>
        <section className="food-intro"><div><h1>Compare the label.</h1><p>A food reference for Indian shoppers. Search packaged products, compare nutrition on the same basis, and trace every record to its source.</p></div><p className="basis-key"><strong>Keep the basis in view</strong>Food facts per 100 g or 100 ml<br />Recipes per stated serving</p></section>
        <form className="food-filters" role="search" onSubmit={(event) => event.preventDefault()}>
          <label className="food-search" htmlFor="food-search"><span className="sr-only">Search foods, brands or barcodes</span><Input id="food-search" type="search" value={filters.q} onChange={(event) => changeFilters({ q: event.target.value })} placeholder="Search a food, brand or barcode" /></label>
          <label htmlFor="food-category"><span className="sr-only">Category</span><select id="food-category" value={filters.category} onChange={(event) => changeFilters({ category: event.target.value })}><option value="all">All categories</option>{Object.entries({ protein_powder: "Protein powders", protein_bar: "Protein bars", protein_snack: "Protein snacks", soy_product: "Soy & tofu", dairy: "Dairy", plant_dairy: "Plant dairy", ready_to_drink: "Drinks", breakfast: "Breakfast", spread: "Spreads", other: "Other foods" }).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label htmlFor="food-scope"><span className="sr-only">Food scope</span><select id="food-scope" value={filters.scope} onChange={(event) => changeFilters({ scope: event.target.value })}><option value="all">All foods</option><option value="protein">Protein foods</option><option value="protein_branded">Protein-branded foods</option></select></label>
          <label htmlFor="food-sort"><span className="sr-only">Sort foods</span><select id="food-sort" aria-label="Sort foods" value={`${filters.sort}:${filters.order}`} onChange={(event) => { const [sort, order] = event.target.value.split(":"); if (sort && isCatalogSort(sort) && (order === "asc" || order === "desc")) changeFilters({ sort, order }); }}>{CATALOG_SORTS.map((sort) => <optgroup key={sort.key} label={sort.label}>{(["desc", "asc"] as const).map((order) => <option key={order} value={`${sort.key}:${order}`}>{sort.label} · {sort.key === "name" ? order === "asc" ? "A–Z" : "Z–A" : order === "asc" ? "low to high" : "high to low"}</option>)}</optgroup>)}</select></label>
        </form>
        <p className="food-sort-note">Sorts cover all results. Missing, conflicting or non-comparable amounts stay last.</p>
        <section className="food-ledger" aria-label="Food nutrition reference" aria-busy={loading}><div className="ledger-heading"><h2>Nutrition reference</h2><p role="status">{loading ? "Loading food records…" : error ? "Could not load records" : `${catalog?.pagination.total.toLocaleString("en-IN") ?? 0} ${catalog?.pagination.total === 1 ? "product" : "products"}`}</p></div>
          {error && <div className="food-error" role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>Try again</Button></div>}
          {loading && !catalog && <div className="food-loading" role="status">Loading the catalog…</div>}
          {!error && catalog && <CatalogTable showUnverifiedStatus={false} data={catalog} busy={loading} sort={displayedSort} order={displayedOrder} onSort={(sort) => changeFilters({ sort, order: nextSortOrder(displayedSort, displayedOrder, sort) })} onOpen={setSelected} onExplore={() => changeFilters({ q: "", category: "all", scope: "all" })} page={catalog.pagination.page} onPage={(next) => { setPage(next); document.querySelector(".food-ledger")?.scrollIntoView({ block: "start" }); }} />}
        </section>
        <aside className="food-context"><strong>Data from Open Food Facts</strong><p>Open a product to see its source and observation date. Missing and conflicting values are flagged. <a href="/sources" onClick={(event) => { event.preventDefault(); navigate("sources"); }}>See the data-quality report</a>.</p></aside>
      </>}
      {view === "recipes" && <Recipes />}
      {view === "sources" && <Sources />}
    </main>
    <footer className="food-footer"><span>Food by Significant Hobbies</span><span><a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a> · <a href="https://github.com/Significant-Hobbies/food">Source code</a></span></footer>
    {selected && <ProductDrawer showUnverifiedStatus={false} detail={detail} loading={detailLoading} error={detailError} onClose={() => setSelected(null)} />}
  </div>;
}
