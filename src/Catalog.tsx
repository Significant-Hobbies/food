import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CatalogProduct, CatalogResponse, NutritionEvidenceStatus, ProductDetailResponse } from "../shared/api";
import type { MetricResult } from "../shared/types";
import type { CatalogSort, SortOrder } from "../shared/catalog-sort";
import { Button } from "@saas-maker/ui/atoms/button";
import { NativeDialog } from "@saas-maker/ui/atoms/native-controls";
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
  return <div className={`product-visual product-visual-${size}`} aria-hidden="true">
    {image && sources && !failed ? <ResponsiveImage src={original ? image : sources.src} srcSet={original ? undefined : sources.srcSet} alt="" width={size === "large" ? 90 : 42} height={size === "large" ? 120 : 62} className="product-image" imageClassName="object-contain" loading={eager || size === "large" ? "eager" : "lazy"} fetchPriority={priority || size === "large" ? "high" : "auto"} onError={() => { if (!original && sources.src !== image) setOriginal(true); else setFailed(true); }} /> : <span>{initials || "F"}</span>}
  </div>;
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
      {product.marketedProtein && <span className="tag tag-market">marketed protein</span>}
      {product.nutritionallyProteinDense === true && <span className="tag tag-dense">protein-dense</span>}
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
      <div className="empty empty-catalog">
        <span className="empty-mark" aria-hidden="true">0</span>
        <strong>{data.trustedDefault ? "No fully trusted products yet." : "No products match this view."}</strong>
        <span>{data.trustedDefault ? "Trusted comparisons require exact current identity, verified nutrition, and terminal ingredient evidence." : "Try a broader category, scope, or evidence filter."}</span>
        {data.trustedDefault && <Button variant="ghost" onClick={onExplore}>Explore the discovery catalog</Button>}
      </div>
    );
  }
  return (
    <>
      {!mobile && <div className="catalog-desktop">
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
          <article className="product-card" key={product.id} onClick={(event) => { if ((event.target as HTMLElement).closest("button, a") || window.getSelection()?.toString()) return; event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus(); onOpen(product.id); }}>
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
          </article>
        ))}
      </div>}
      {data.pagination.pages > 1 && <nav className="pagination" aria-label="Catalog pages"><Button variant="ghost" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>← Previous</Button><span>Page <strong>{page}</strong> of {data.pagination.pages.toLocaleString("en-IN")}</span><Button variant="ghost" disabled={busy || page >= data.pagination.pages} onClick={() => onPage(page + 1)}>Next →</Button></nav>}
    </>
  );
}

export function ProductDrawer({ detail, loading, error, onClose, showUnverifiedStatus = true }: {
  detail: ProductDetailResponse | null;
  showUnverifiedStatus?: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const sourceNutrition = !showUnverifiedStatus && detail?.nutritionStatus === "unverified";
  const sourceLabel = detail && detail.sourceRecords.length > 0 && detail.sourceRecords.every((record) => record.source === "open_food_facts") ? "Open Food Facts" : "Source nutrition";
  const evidenceUrl = publicEvidenceUrl(detail?.nutritionEvidenceUrl ?? null);
  const observedAt = detail?.nutrition.observedAt;
  const observedDate = observedAt && Number.isFinite(Date.parse(observedAt)) ? new Date(observedAt).toISOString().slice(0, 10) : null;
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <NativeDialog ref={drawerRef} className="drawer" role="dialog" aria-modal="true" aria-label="Product evidence detail" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
        <Button variant="ghost" ref={closeRef} className="close" onClick={onClose} aria-label="Close product detail">×</Button>
        {loading && <div className="loading" role="status">Loading product evidence…</div>}
        {error && <div className="error-state" role="alert">{error}</div>}
        {detail && (
          <>
            <header className="detail-head">
              <ProductVisual product={detail} size="large" />
              <div><p className="eyebrow">{detail.brand} · {detail.category.replaceAll("_", " ")}</p><h2>{detail.name}</h2><p>{detail.flavour ?? "No flavour declared"} · GTIN {detail.gtin ?? "not recorded"}</p><div className="product-pack-meta"><span><small>Pack size</small><strong>{detail.netQuantityGrams === null ? "Not recorded" : `${formatNumber(detail.netQuantityGrams, 0)} g`}</strong></span><span><small>Serving size</small><strong>{detail.servingSizeGrams === null ? "Not recorded" : `${formatNumber(detail.servingSizeGrams, 1)} g`}</strong></span></div><ClassificationBadges product={detail} /></div>
            </header>

            <section>
              <div className="section-title"><div><h3>Macros · {nutritionBasisLabel(detail.nutrition.basis)}</h3><small>Per declared nutrition basis</small></div></div>
              <div className="nutrition-evidence" aria-label="Nutrition evidence">
                <p><strong>{sourceNutrition ? sourceLabel : metricEvidenceLabel(detail.nutritionStatus)}</strong></p>
                {!sourceNutrition && <p>{detail.nutritionEvidenceAuthority === "human_reviewed_label" ? "Human-reviewed label." : detail.nutritionEvidenceAuthority === "authoritative_source" ? "Authoritative source record." : detail.nutritionEvidenceAuthority === "machine_verified_label" ? "Machine-checked label; not human reviewed." : detail.nutritionEvidenceAuthority === "first_party_structured_source" ? "Brand-provided structured data; not a human-reviewed label." : detail.nutritionEvidenceAuthority === "community" ? "Community-provided data." : "Evidence authority not recorded."}</p>}
                {(evidenceUrl || !sourceNutrition) && <p>{evidenceUrl ? <a href={evidenceUrl} target="_blank" rel="noreferrer">{detail.nutritionEvidenceKind === "label" ? "View original nutrition label" : "View nutrition source"} ↗</a> : "Original nutrition source link unavailable."}</p>}
                <small>{observedDate ? <>Observed <time dateTime={observedAt ?? undefined}>{observedDate}</time></> : "Observation date unavailable."}</small>
              </div>
              <div className="nutrition-grid">
                {[
                  ["Protein", detail.nutrition.proteinGrams, "g"],
                  ["Carbohydrate", detail.nutrition.carbohydrateGrams, "g"],
                  ["Fat", detail.nutrition.fatGrams, "g"],
                  ["Fibre", detail.nutrition.fibreGrams, "g"],
                  ["Calories", detail.nutrition.calories, "kcal"],
                ].map(([label, value, unit]) => <div key={String(label)}><span>{label}</span><strong>{formatNumber(value as number | null)} {unit}</strong></div>)}
              </div>
            </section>

            <section>
              <h3>Protein density</h3>
              <p>{showUnverifiedStatus ? "Calculated from the macros above; the same evidence status applies." : "Calculated from the macros above."}</p>
              <div className="metric-grid">
                <div><span>Protein / 100 kcal</span><strong><MetricValue result={detail.metrics.proteinPer100Calories} suffix=" g" /></strong></div>
              </div>
            </section>

            <section aria-label="Original catalog sources">
              <h3>Original catalog sources</h3>
              <p>{showUnverifiedStatus ? "Records associated with this product. These links do not verify the macros above." : "Product records and original source links."}</p>
              {detail.sourceRecords.length === 0 ? <p>No source records available.</p> : <ul>
                {detail.sourceRecords.map((record) => {
                  const url = publicEvidenceUrl(record.sourceUrl);
                  const date = Number.isFinite(Date.parse(record.observedAt)) ? new Date(record.observedAt).toISOString().slice(0, 10) : null;
                  return <li key={record.id}>
                    {url ? <a href={url} target="_blank" rel="noreferrer">{record.source.replaceAll("_", " ")} ↗</a> : <span>{record.source.replaceAll("_", " ")} · source link unavailable</span>}
                    {date ? <> · observed <time dateTime={record.observedAt}>{date}</time></> : " · observation date unavailable"}
                  </li>;
                })}
              </ul>}
            </section>
          </>
        )}
    </NativeDialog>
  );
}

