import { useRef, useState } from "react";
import type { ProductDetailResponse } from "../shared/api";
import { Button } from "@saas-maker/ui/atoms/button";
import { Sheet, SheetContent, SheetTitle, SheetClose } from "@saas-maker/ui/molecules/sheet";
import { Skeleton } from "@saas-maker/ui/atoms/skeleton";
import { ErrorState } from "@saas-maker/ui/molecules/error-state";
import { ProductVisual, ClassificationBadges, MetricValue, formatNumber, metricEvidenceLabel, nutritionBasisLabel, publicEvidenceUrl } from "./Catalog";

export function ProductDrawer({ detail, loading, error, onClose, showUnverifiedStatus = true }: {
  detail: ProductDetailResponse | null;
  showUnverifiedStatus?: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [returnFocus] = useState(() => typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent className="drawer" showCloseButton={false} aria-label="Product evidence detail" aria-describedby={undefined}
      onOpenAutoFocus={(event) => { event.preventDefault(); closeRef.current?.focus(); }}
      onCloseAutoFocus={(event) => { event.preventDefault(); if (returnFocus?.isConnected) returnFocus.focus(); }}>
      <SheetTitle className="sr-only">Product evidence detail</SheetTitle>
      <SheetClose asChild><Button ref={closeRef} variant="ghost" size="icon" className="close" aria-label="Close product detail">×</Button></SheetClose>
      {loading && <Skeleton role="status" aria-label="Loading product evidence…" className="h-48 w-full" />}
      {error && <ErrorState title="Product could not be loaded" description={error} />}
      {detail && <ProductEvidence detail={detail} showUnverifiedStatus={showUnverifiedStatus} />}
    </SheetContent>
  </Sheet>;
}

export function ProductEvidence({ detail, showUnverifiedStatus = true }: { detail: ProductDetailResponse; showUnverifiedStatus?: boolean }) {
  const sourceNutrition = !showUnverifiedStatus && detail?.nutritionStatus === "unverified";
  const sourceLabel = detail && detail.sourceRecords.length > 0 && detail.sourceRecords.every((record) => record.source === "open_food_facts") ? "Open Food Facts" : "Source nutrition";
  const evidenceUrl = publicEvidenceUrl(detail?.nutritionEvidenceUrl ?? null);
  const observedAt = detail?.nutrition.observedAt;
  const observedDate = observedAt && Number.isFinite(Date.parse(observedAt)) ? new Date(observedAt).toISOString().slice(0, 10) : null;
  return (          <>
            <header className="detail-head">
              <ProductVisual product={detail} size="large" />
              <div><p className="eyebrow">{detail.brand} · {detail.category.replaceAll("_", " ")}</p><h2>{detail.name}</h2><p>{detail.flavour ?? "No flavour declared"} · GTIN {detail.gtin ?? "not recorded"}</p><div className="product-pack-meta"><span><small>Pack size</small><strong>{detail.netQuantityGrams === null ? "Not recorded" : `${formatNumber(detail.netQuantityGrams, 0)} g`}</strong></span><span><small>Serving size</small><strong>{detail.servingSizeGrams === null ? "Not recorded" : `${formatNumber(detail.servingSizeGrams, 1)} g`}</strong></span></div><ClassificationBadges product={detail} /></div>
            </header>

            <section>
              <div className="section-title"><div><h3>Macros · {nutritionBasisLabel(detail.nutrition.basis)}</h3><small>Per declared nutrition basis</small></div></div>
              <div className="nutrition-evidence" aria-label="Nutrition evidence">
                <p><strong>{sourceNutrition ? sourceLabel : metricEvidenceLabel(detail.nutritionStatus)}</strong></p>
                {!sourceNutrition && <p>{detail.nutritionEvidenceAuthority === "human_reviewed_label" ? "Human-reviewed label." : detail.nutritionEvidenceAuthority === "authoritative_source" ? "Authoritative source record." : detail.nutritionEvidenceAuthority === "machine_verified_label" ? "Machine-checked label; not human reviewed." : detail.nutritionEvidenceAuthority === "first_party_structured_source" ? "Brand-provided structured data; not a human-reviewed label." : detail.nutritionEvidenceAuthority === "community" ? "Community-provided data." : "Evidence authority not recorded."}</p>}
                {(evidenceUrl || !sourceNutrition) && <p>{evidenceUrl ? <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href={evidenceUrl} target="_blank" rel="noreferrer">{detail.nutritionEvidenceKind === "label" ? "View original nutrition label" : "View nutrition source"} ↗</a></Button> : "Original nutrition source link unavailable."}</p>}
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
                    {url ? <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href={url} target="_blank" rel="noreferrer">{record.source.replaceAll("_", " ")} ↗</a></Button> : <span>{record.source.replaceAll("_", " ")} · source link unavailable</span>}
                    {date ? <> · observed <time dateTime={record.observedAt}>{date}</time></> : " · observation date unavailable"}
                  </li>;
                })}
              </ul>}
            </section>
          </>
  );
}
