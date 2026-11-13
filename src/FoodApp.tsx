import { Button } from "@saas-maker/ui/atoms/button";
import { Label } from "@saas-maker/ui/atoms/label";
import { Card, CardHeader, CardTitle } from "@saas-maker/ui/atoms/card";
import { Skeleton } from "@saas-maker/ui/atoms/skeleton";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@saas-maker/ui/molecules/navigation-menu";
import { ErrorState } from "@saas-maker/ui/molecules/error-state";
import { NativeSelect } from "@saas-maker/ui/atoms/native-controls";
import { Component, lazy, Suspense, type ReactNode, useEffect, useState } from "react";
import { Input } from "@saas-maker/ui/atoms/input";
import { CatalogTable } from "./Catalog";
import { api } from "./api";
import { CATALOG_SORTS, defaultSortOrder, isCatalogSort, nextSortOrder, type CatalogSort, type SortOrder } from "../shared/catalog-sort";
const ProductDrawer = lazy(() => import("./ProductDrawer").then((module) => ({ default: module.ProductDrawer })));
const Sources = lazy(() => import("./Sources").then((module) => ({ default: module.Sources })));
const Recipes = lazy(() => import("./Recipes").then((module) => ({ default: module.Recipes })));
import type { CatalogResponse, ProductDetailResponse } from "../shared/api";

class RecipeBoundary extends Component<{ children: ReactNode; name?: string }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() {
    return this.state.failed ? <ErrorState title={(this.props.name ?? "Recipes") + " couldn’t load"} description="Check your connection and reload this section." onRetry={() => window.location.reload()} /> : this.props.children;
  }
}

type View = "foods" | "recipes" | "sources";
type Filters = { q: string; category: string; scope: string; sort: CatalogSort; order: SortOrder };


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
  const [query, setQuery] = useState(filters.q);
  useEffect(() => {
    if (!filters.q) { setQuery(""); return; }
    const timer = window.setTimeout(() => setQuery(filters.q), 180);
    return () => window.clearTimeout(timer);
  }, [filters.q]);
  const searching = loading || query !== filters.q;
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
    if (view !== "foods" || query !== filters.q) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    const params = new URLSearchParams({ ...filters, q: query, trust: "all", verification: "all", ingredientVerification: "all", page: String(page), pageSize: "25" });
    api.catalog(params, controller.signal).then((result) => { if (controller.signal.aborted) return; setCatalog(result); setLoading(false); })
      .catch((reason: unknown) => { if (controller.signal.aborted) return; setError(reason instanceof Error ? reason.message : "Food data could not be loaded."); setLoading(false); });
    return () => controller.abort();
  }, [query, filters.q, filters.category, filters.scope, filters.sort, filters.order, page, retry, view]);
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
    <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a className="skip-link" href="#main">Skip to content</a></Button>
    <header className="food-topbar"><Button asChild variant="link" className="h-auto whitespace-normal text-left"><a className="food-wordmark" href="/" onClick={(event) => { event.preventDefault(); navigate("foods"); }}>Food /</a></Button><NavigationMenu viewport={false} aria-label="Main navigation" className="food-navigation"><NavigationMenuList>{(["foods", "recipes", "sources"] as const).map((item) => <NavigationMenuItem key={item}><NavigationMenuLink active={view === item} href={item === "foods" ? "/" : `/${item}`} aria-current={view === item ? "page" : undefined} onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(item); }}>{item === "foods" ? "Foods" : item === "recipes" ? "Recipes" : "Data & sources"}</NavigationMenuLink></NavigationMenuItem>)}</NavigationMenuList></NavigationMenu><Button asChild variant="link" className="h-auto whitespace-normal text-left"><a className="food-family" href="https://significanthobbies.com">Significant Hobbies</a></Button></header>
    <main id="main" className="food-main">
      {view === "foods" && <>
        <section className="food-intro"><div><h1>Compare the label.</h1><p>A food reference for Indian shoppers. Search packaged products, compare nutrition on the same basis, and trace every record to its source.</p></div><p className="basis-key"><strong>Keep the basis in view</strong>Food facts per 100 g or 100 ml<br />Recipes per stated serving</p></section>
        <form className="food-filters" role="search" onSubmit={(event) => event.preventDefault()}>
          <Label className="food-search" htmlFor="food-search"><span className="sr-only">Search foods, brands or barcodes</span><Input id="food-search" type="search" value={filters.q} onChange={(event) => changeFilters({ q: event.target.value })} placeholder="Search a food, brand or barcode" /></Label>
          <Label htmlFor="food-category"><span className="sr-only">Category</span><NativeSelect id="food-category" value={filters.category} onChange={(event) => changeFilters({ category: event.target.value })}><option value="all">All categories</option>{Object.entries({ protein_powder: "Protein powders", protein_bar: "Protein bars", protein_snack: "Protein snacks", soy_product: "Soy & tofu", dairy: "Dairy", plant_dairy: "Plant dairy", ready_to_drink: "Drinks", breakfast: "Breakfast", spread: "Spreads", other: "Other foods" }).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</NativeSelect></Label>
          <Label htmlFor="food-scope"><span className="sr-only">Food scope</span><NativeSelect id="food-scope" value={filters.scope} onChange={(event) => changeFilters({ scope: event.target.value })}><option value="all">All foods</option><option value="protein">Protein foods</option><option value="protein_branded">Protein-branded foods</option></NativeSelect></Label>
          <Label htmlFor="food-sort"><span className="sr-only">Sort foods</span><NativeSelect id="food-sort" aria-label="Sort foods" value={`${filters.sort}:${filters.order}`} onChange={(event) => { const [sort, order] = event.target.value.split(":"); if (sort && isCatalogSort(sort) && (order === "asc" || order === "desc")) changeFilters({ sort, order }); }}>{CATALOG_SORTS.map((sort) => <optgroup key={sort.key} label={sort.label}>{(["desc", "asc"] as const).map((order) => <option key={order} value={`${sort.key}:${order}`}>{sort.label} · {sort.key === "name" ? order === "asc" ? "A–Z" : "Z–A" : order === "asc" ? "low to high" : "high to low"}</option>)}</optgroup>)}</NativeSelect></Label>
        </form>
        <p className="food-sort-note">Sorts cover all results. Missing, conflicting or non-comparable amounts stay last.</p>
        <Card className="food-ledger gap-0 rounded-none py-0" aria-label="Food nutrition reference" aria-busy={searching}><CardHeader className="ledger-heading"><CardTitle role="heading" aria-level={2}>Nutrition reference</CardTitle><p role="status">{searching ? "Loading food records…" : error ? "Could not load records" : `${catalog?.pagination.total.toLocaleString("en-IN") ?? 0} ${catalog?.pagination.total === 1 ? "product" : "products"}`}</p></CardHeader>
          {error && <ErrorState title="Food records could not be loaded" description={error} onRetry={() => setRetry((value) => value + 1)} />}
          {searching && !catalog && <Skeleton className="h-48 w-full" role="status" aria-label="Loading the catalog…" />}
          {!error && catalog && <CatalogTable showUnverifiedStatus={false} data={catalog} busy={searching} sort={displayedSort} order={displayedOrder} onSort={(sort) => changeFilters({ sort, order: nextSortOrder(displayedSort, displayedOrder, sort) })} onOpen={setSelected} onExplore={() => changeFilters({ q: "", category: "all", scope: "all" })} page={catalog.pagination.page} onPage={(next) => { setPage(next); document.querySelector(".food-ledger")?.scrollIntoView({ block: "start" }); }} />}
        </Card>
        <aside className="food-context"><strong>Packaged-food data: Open Food Facts</strong><p>Open a product to see its source and observation date. Missing and conflicting values are flagged. <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="/sources" onClick={(event) => { event.preventDefault(); navigate("sources"); }}>See the data-quality report</a></Button>.</p></aside>
      </>}
      {view === "recipes" && <RecipeBoundary><Suspense fallback={<Skeleton className="h-48 w-full" role="status" aria-label="Loading recipes…" />}><Recipes /></Suspense></RecipeBoundary>}
      {view === "sources" && <RecipeBoundary name="Data & sources"><Suspense fallback={<Skeleton className="h-48 w-full" role="status" aria-label="Loading data & sources…" />}><Sources /></Suspense></RecipeBoundary>}
    </main>
    <footer className="food-footer"><span>Food by Significant Hobbies</span><span><Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a></Button> · <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a></Button> · <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="https://github.com/Significant-Hobbies/food">Source code</a></Button></span></footer>
    {selected && <RecipeBoundary key={selected} name="Product details"><Suspense fallback={<Skeleton role="status" aria-label="Opening product…" className="h-12 w-full" />}><ProductDrawer showUnverifiedStatus={false} detail={detail} loading={detailLoading} error={detailError} onClose={() => setSelected(null)} /></Suspense></RecipeBoundary>}
  </div>;
}
