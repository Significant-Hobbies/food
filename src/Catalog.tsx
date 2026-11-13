import { Avatar, AvatarFallback } from "@saas-maker/ui/atoms/avatar";
import { Card } from "@saas-maker/ui/atoms/card";
import { Badge } from "@saas-maker/ui/atoms/badge";
import { EmptyState } from "@saas-maker/ui/molecules/empty-state";
import { Pagination } from "@saas-maker/ui/molecules/pagination";
import { useState, useSyncExternalStore } from "react";
import type { CatalogProduct, CatalogResponse, NutritionEvidenceStatus } from "../shared/api";
import type { MetricResult } from "../shared/types";
import type { CatalogSort, SortOrder } from "../shared/catalog-sort";
import { Button } from "@saas-maker/ui/atoms/button";
import { ResponsiveImage } from "@saas-maker/ui/atoms/responsive-image";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@saas-maker/ui/atoms/table";
import { productImageSources } from "./product-image";
import imageExceptions from "../data/image-quality-exceptions.json";

export function metricEvidenceLabel(status: NutritionEvidenceStatus): string {
  return status === "machine_verified" ? "machine-verified from label" : status === "verified" ? "verified nutrition" : status === "unverified" ? "unverified nutrition" : `${status} nutrition`;
}

const numberFormats = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number | null, digits = 1): string {
  if (value === null) return "—";
  if (!numberFormats.has(digits)) numberFormats.set(digits, new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }));
  return numberFormats.get(digits)!.format(value);
}

export function metric(result: MetricResult, suffix = ""): string {
  return result.value === null ? "—" : `${formatNumber(result.value, 2)}${suffix}`;
}

export function nutritionBasisLabel(basis: CatalogProduct["nutrition"]["basis"]): string {
  return basis === "per_100ml" ? "per 100 ml" : basis === "per_serving" ? "per serving" : basis === "per_100g" ? "per 100 g" : "declared basis not stated";
}

export function publicEvidenceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function MetricValue({ result, prefix = "", suffix = "" }: { result: MetricResult; prefix?: string; suffix?: string }) {
  if (result.value === null) {
    return <span className="metric-unavailable">Unavailable<small>{(result.reason ?? "missing inputs").replaceAll("_", " ")}</small></span>;
  }
  return <>{prefix}{formatNumber(result.value, 2)}{suffix}</>;
}

type ProductVisualProps = { product: Pick<CatalogProduct, "imageUrl" | "brand" | "name">; size?: "small" | "large"; eager?: boolean; priority?: boolean };

export function ProductVisual(props: ProductVisualProps) {
  return <ProductImage key={`${props.product.imageUrl}:${props.size}`} {...props} />;
}

function ProductImage({ product, size = "small", eager = false, priority = false }: ProductVisualProps) {
  const [failed, setFailed] = useState(false);
  const [original, setOriginal] = useState(false);
  const initials = `${product.brand} ${product.name}`.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  const image = product.imageUrl && !imageExceptions.some((exception) => exception.imageUrl === product.imageUrl) ? product.imageUrl : null;
  const sources = image ? productImageSources(image, size) : null;
  return <Avatar className={`product-visual product-visual-${size}`} aria-hidden="true">
    {image && sources && !failed ? <ResponsiveImage src={original ? image : sources.src} srcSet={original ? undefined : sources.srcSet} alt="" width={size === "large" ? 90 : 42} height={size === "large" ? 120 : 62} className="product-image" imageClassName="object-contain" loading={eager || size === "large" ? "eager" : "lazy"} fetchPriority={priority || size === "large" ? "high" : "auto"} onError={() => { if (!original && sources.src !== image) setOriginal(true); else setFailed(true); }} /> : <AvatarFallback className="rounded-none">{initials || "F"}</AvatarFallback>}
  </Avatar>;
}

const mobileQuery = "(max-width: 1000px)";
const subscribeLayout = (callback: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const desktopSnapshot = () => false;

export function ClassificationBadges({ product }: { product: CatalogProduct }) {
  return (
    <div className="badge-row">
      {product.marketedProtein && <Badge variant="secondary">marketed protein</Badge>}
      {product.nutritionallyProteinDense === true && <Badge variant="outline">protein-dense</Badge>}
    </div>
  );
}

export function CatalogTable({ data, onOpen, onExplore, page, onPage, sort, order = "desc", onSort, busy = false, showUnverifiedStatus = true }: {
  data: CatalogResponse;
  busy?: boolean;
  showUnverifiedStatus?: boolean;
  sort?: CatalogSort;
  order?: SortOrder;
  onSort?: (sort: CatalogSort) => void;
  onOpen: (id: string) => void;
  onExplore: () => void;
  page: number;
  onPage: (page: number) => void;
}) {
  const mobile = useSyncExternalStore(subscribeLayout, mobileSnapshot, desktopSnapshot);
  if (data.products.length === 0) {
    return (
      <EmptyState className="empty-catalog" title={data.trustedDefault ? "No fully trusted products yet." : "No products match this view."}
        description={data.trustedDefault ? "Trusted comparisons require exact current identity, verified nutrition, and terminal ingredient evidence." : "Try a broader category, scope, or evidence filter."}
        primaryAction={{ label: data.trustedDefault ? "Explore the discovery catalog" : "Reset filters", onClick: onExplore }} />
    );
  }
  return (
    <>
      {!mobile && <div className="table-wrap catalog-desktop">
        <Table>
        <TableHeader>
          <TableRow>
            {([["name", "Product"], ["protein_density", "Protein / 100 kcal"], ["protein", "Protein"], ["carbs", "Carbs"], ["fat", "Fat"], ["fibre", "Fibre"], ["calories", "Calories"]] as const).map(([key, label]) => <TableHead key={key} scope="col" aria-sort={onSort ? sort === key ? order === "asc" ? "ascending" : "descending" : "none" : undefined}>
              {onSort ? <Button variant="ghost" className="column-sort" onClick={() => onSort(key)}>{label}<span aria-hidden="true">{sort === key ? order === "asc" ? "↑" : "↓" : "↕"}</span></Button> : label}
            </TableHead> )}
          </TableRow>
        </TableHeader>
        <TableBody inert={busy}>
          {data.products.map((product, index) => (
            <TableRow key={product.id} className="product-row" onClick={(event) => { if ((event.target as HTMLElement).closest("button, a") || window.getSelection()?.toString()) return; event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus(); onOpen(product.id); }}>
              <TableCell className="product-cell">
                <div className="product-identity"><ProductVisual product={product} eager={index < 4} priority={index === 0} /><div><Button variant="ghost" className="product-link h-auto whitespace-normal" onClick={() => onOpen(product.id)}><strong>{product.name}</strong><span>{product.brand}{product.flavour ? ` · ${product.flavour}` : ""}</span></Button><ClassificationBadges product={product} /></div></div>
              </TableCell>
              <TableCell className="metric-primary"><strong>{metric(product.metrics.proteinPer100Calories, " g")}</strong>{(showUnverifiedStatus || product.nutritionStatus !== "unverified") && <small>{metricEvidenceLabel(product.nutritionStatus)}</small>}</TableCell>
              <TableCell><strong>{formatNumber(product.nutrition.proteinGrams)} g</strong><small>{nutritionBasisLabel(product.nutrition.basis)}</small></TableCell>
              <TableCell><strong>{formatNumber(product.nutrition.carbohydrateGrams)} g</strong><small>{nutritionBasisLabel(product.nutrition.basis)}</small></TableCell>
              <TableCell><strong>{formatNumber(product.nutrition.fatGrams)} g</strong><small>{nutritionBasisLabel(product.nutrition.basis)}</small></TableCell>
              <TableCell><strong>{formatNumber(product.nutrition.fibreGrams)} g</strong><small>{nutritionBasisLabel(product.nutrition.basis)}</small></TableCell>
              <TableCell><strong>{product.nutrition.calories === null ? "—" : `${formatNumber(product.nutrition.calories)} kcal`}</strong><small>{nutritionBasisLabel(product.nutrition.basis)}</small></TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>}
      {mobile && <div className="catalog-mobile" aria-label="Catalog products" inert={busy}>
        {data.products.map((product, index) => (
          <Card role="article" className="product-card gap-0 rounded-none border-x-0 border-t-0 shadow-none" key={product.id} onClick={(event) => { if ((event.target as HTMLElement).closest("button, a") || window.getSelection()?.toString()) return; event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus(); onOpen(product.id); }}>
            <Button variant="ghost" className="product-card-main h-auto whitespace-normal" onClick={() => onOpen(product.id)}>
              <ProductVisual product={product} eager={index === 0} priority={index === 0} />
              <span className="product-card-copy"><small>{product.brand}</small><strong>{product.name}</strong><em>{product.flavour ?? product.category.replaceAll("_", " ")}</em></span>
              <span className="card-arrow" aria-hidden="true">↗</span>
            </Button>
            <div className="product-card-metric"><strong>{metric(product.metrics.proteinPer100Calories, " g")}</strong><span>protein / 100 kcal</span>{(showUnverifiedStatus || product.nutritionStatus !== "unverified") && <small>{metricEvidenceLabel(product.nutritionStatus)}</small>}</div>
            <p className="product-card-basis">Macros {nutritionBasisLabel(product.nutrition.basis)}</p>
            <div className="product-card-macros" aria-label={`Macros ${nutritionBasisLabel(product.nutrition.basis)}`}>
              {[["Protein", product.nutrition.proteinGrams], ["Carbs", product.nutrition.carbohydrateGrams], ["Fat", product.nutrition.fatGrams], ["Fibre", product.nutrition.fibreGrams], ["Calories", product.nutrition.calories]].map(([label, value]) => <span key={String(label)}><small>{label}</small><strong>{formatNumber(value as number | null)}{label === "Calories" ? " kcal" : " g"}</strong></span>)}
            </div>
          </Card>
        ))}
      </div>}
      {data.pagination.pages > 1 && <div inert={busy} aria-busy={busy}><Pagination className="pagination" page={page - 1} pageCount={data.pagination.pages} rowCount={data.pagination.total} pageSize={data.pagination.pageSize} onPageChange={(next) => { if (!busy) onPage(next + 1); }} /></div>}
    </>
  );
}

