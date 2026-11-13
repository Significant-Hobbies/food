import { useEffect, useState } from "react";
import { Button } from "@saas-maker/ui/atoms/button";
import { Skeleton } from "@saas-maker/ui/atoms/skeleton";
import { ErrorState } from "@saas-maker/ui/molecules/error-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@saas-maker/ui/atoms/table";

type Quality = {
  source: string; sourceUpdatedAt: string; preparedAt: string;
  recordsRead: number; indiaRecords: number; stagedRecords: number; excludedRecords: number;
  canonicalProducts: number; usableNutrition: number; completeCoreMacros: number; withIngredients: number;
  nutritionConflicts: number; missingNutrition: number; withLabelImage: number;
  duplicateBarcodes: number; kilojouleConversions: number; sourceErrors: number;
  downloadPath: string; limitations: string[];
  labelSpotChecks: Array<{ code: string; sourceUrl: string; result: string; note: string }>;
};

export function Sources() {
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
    <p className="lede">Open Food Facts is the only source for packaged-food nutrition. Recipes use estimates from their original publishers. Source links, observation dates and data checks are available below.</p>
    {error && <ErrorState title="The quality report could not be loaded." onRetry={load} />}
    {!quality && !error && <Skeleton className="h-48 w-full" role="status" aria-label="Loading the snapshot report…" />}
    {quality && <>
      <dl className="source-meta"><div><dt>Food source</dt><dd><Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="https://world.openfoodfacts.org/data" target="_blank" rel="noreferrer">Open Food Facts bulk export</a></Button></dd></div><div><dt>Latest source edit</dt><dd>{quality.sourceUpdatedAt.slice(0, 10)}</dd></div><div><dt>Prepared snapshot</dt><dd>{quality.preparedAt.slice(0, 10)}</dd></div><div><dt>Scope</dt><dd>Products tagged as sold in India</dd></div></dl>
      <h2>What the snapshot contains</h2>
      <Table className="quality-table"><TableHeader><TableRow><TableHead>Check</TableHead><TableHead>Records</TableHead><TableHead>What it means</TableHead></TableRow></TableHeader><TableBody>{[
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
      ].map(([label, count, meaning]) => <TableRow key={String(label)}><TableHead scope="row">{label}</TableHead><TableCell>{Number(count).toLocaleString("en-IN")}</TableCell><TableCell>{meaning}</TableCell></TableRow>)}</TableBody></Table>
      <h2>Selected label spot checks</h2><p>Three selected examples were visually compared with their source images. This is not a random sample or a catalog-wide accuracy estimate. Flagged records remain conflicts; no record was promoted to human-verified.</p><ul className="source-limits">{quality.labelSpotChecks.map((check) => <li key={check.code}><Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href={check.sourceUrl} target="_blank" rel="noreferrer">{check.code}</a></Button> · {check.result.replaceAll("_", " ")}. {check.note}</li>)}</ul>
      <h2>Limits to keep in mind</h2><ul className="source-limits">{quality.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
      <p><Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href={quality.downloadPath} download>Download the attributed food snapshot</a></Button> · <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Database License</a></Button>. Product images have separate rights, including Open Food Facts’ <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA</a></Button> terms.</p>
    </>}
    <h2>Recipes are a separate collection</h2><p>50 egg-free vegetarian recipes from 14 original publishers, collected on 15 August 2026. Nutrition is the publisher’s estimate for its stated serving. Food labels use a per-100-g or per-100-ml basis; recipe servings are not treated as the same portion. Read the original recipe for instructions and current details.</p>
    <p><Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="/data/recipe-video-archive.json" download>Download the retained video-recipe archive</a></Button>. This historical collection is separate from the 50 curated recipes and their admission criteria.</p>
  </section>;
}

