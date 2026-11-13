import { Card } from "@saas-maker/ui/atoms/card";
import { Checkbox } from "@saas-maker/ui/atoms/checkbox";
import { Label } from "@saas-maker/ui/atoms/label";
import { EmptyState } from "@saas-maker/ui/molecules/empty-state";
import { NativeSelect, NativeDisclosure, NativeSummary } from "@saas-maker/ui/atoms/native-controls";
import { useMemo, useState } from "react";
import { Button } from "@saas-maker/ui/atoms/button";
import { Input } from "@saas-maker/ui/atoms/input";
import { defaultRecipeFilters, filterRecipes, ingredientExclusions, proteinSources, recipeCollectedAt, recipeDensity, recipes } from "../shared/recipes";
import type { RecipeFilters } from "../shared/recipes";

export function Recipes() {
  const [filters, setFilters] = useState(defaultRecipeFilters);
  const results = useMemo(() => filterRecipes(recipes, filters), [filters]);
  const update = (next: Partial<RecipeFilters>) => setFilters((current) => ({ ...current, ...next }));
  const formats = [...new Set(recipes.map((recipe) => recipe.format))];
  return <section className="recipes-view" aria-label="Vegetarian recipes">
    <div className="food-intro"><div><h1>More ideas for your plate.</h1><p>50 egg-free vegetarian recipes from 14 publishers. Find familiar ingredients, compare serving macros, and cook from the original recipe.</p></div><p className="basis-key"><strong>Publisher-stated estimates</strong>Per original recipe serving<br />Collection: {recipeCollectedAt.slice(0, 10)}</p></div>
    <div className="recipe-filters filters">
      <Label htmlFor="recipe-search" className="search-field">Find a recipe<Input id="recipe-search" type="search" value={filters.query} onChange={(event) => update({ query: event.target.value })} placeholder="Tofu, paneer, chickpeas…" /></Label>
      <Label htmlFor="recipe-diet">Diet<NativeSelect id="recipe-diet" value={filters.dietary} onChange={(event) => update({ dietary: event.target.value })}><option value="all">All vegetarian</option><option value="vegan">Vegan</option><option value="vegetarian">Vegetarian with dairy</option></NativeSelect></Label>
      <Label htmlFor="recipe-format">Meal type<NativeSelect id="recipe-format" value={filters.format} onChange={(event) => update({ format: event.target.value })}><option value="all">All meal types</option>{formats.map((format) => <option key={format} value={format}>{format.replaceAll("-", " ")}</option>)}</NativeSelect></Label>
      <Label htmlFor="recipe-protein">Protein source<NativeSelect id="recipe-protein" value={filters.proteinSource} onChange={(event) => update({ proteinSource: event.target.value })}><option value="all">All sources</option>{Object.entries(proteinSources).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</NativeSelect></Label>
      <Label htmlFor="recipe-india">Ingredients in India<NativeSelect id="recipe-india" value={filters.indiaFit} onChange={(event) => update({ indiaFit: event.target.value })}><option value="all">Any availability</option><option value="easy">Easy to find</option><option value="adaptable">Some substitutions</option><option value="specialty">Specialist ingredients</option></NativeSelect></Label>
      <Label htmlFor="recipe-sort">Order by<NativeSelect id="recipe-sort" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}><option value="curated">Collection order</option><option value="protein-density">Protein / 100 kcal</option><option value="protein">Protein per serving</option><option value="calories">Fewest calories</option><option value="title">Recipe name</option></NativeSelect></Label>
    </div>
    <fieldset className="recipe-exclusions"><legend>Leave out</legend>{Object.entries(ingredientExclusions).map(([key, { label }]) => <Label key={key}><Checkbox checked={filters.excludedIngredients.includes(key)} onCheckedChange={(checked) => update({ excludedIngredients: checked === true ? [...filters.excludedIngredients, key] : filters.excludedIngredients.filter((value) => value !== key) })} />{label}</Label>)}</fieldset>
    <div className="recipe-result-heading"><p role="status">{results.length} {results.length === 1 ? "recipe" : "recipes"}{results.length !== recipes.length ? ` of ${recipes.length}` : ""}</p><Button variant="ghost" onClick={() => setFilters(defaultRecipeFilters)}>Reset filters</Button></div>
    <p className="recipe-evidence-note">Macros are publisher estimates per stated serving, not lab-verified values. Ingredient filters match the recorded list; check the original recipe and packaging for allergens.</p>
    {results.length === 0 && <EmptyState title="No recipes match those choices." description="Remove an exclusion or try a different protein source." primaryAction={{ label: "Reset filters", onClick: () => setFilters(defaultRecipeFilters) }} />}
    <div className="recipe-grid">{results.map((recipe) => <Card role="article" className="recipe-card rounded-none border-x-0 border-t-0 shadow-none" key={recipe.id}>
      <div className="recipe-identity"><h2><Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href={recipe.url} target="_blank" rel="noreferrer">{recipe.title}</a></Button></h2><p>{recipe.publisher} · {recipe.format.replaceAll("-", " ")} · {recipe.dietary}</p><p className="recipe-fit">{recipe.indiaFitNote}</p></div>
      <div className="recipe-macros"><div><strong>{recipe.nutrition.protein ?? "—"}<small> g</small></strong><span>protein{recipe.nutrition.proteinQualifier ? ` · ${recipe.nutrition.proteinQualifier}` : ""}</span></div><div><strong>{recipe.nutrition.calories ?? "—"}</strong><span>kcal{recipe.nutrition.calorieQualifier ? ` · ${recipe.nutrition.calorieQualifier}` : ""}</span></div><div><strong>{recipeDensity(recipe) ?? "—"}<small> g</small></strong><span>protein / 100 kcal</span></div></div>
      <p className="recipe-serving">Per {recipe.nutrition.servingBasis.replace(/^1 /, "one ")} · publisher-stated</p>
      <NativeDisclosure><NativeSummary>{recipe.ingredients.length} ingredients & source notes</NativeSummary><ul>{recipe.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul><p>{recipe.nutrition.sourceNote}</p></NativeDisclosure>
      <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a className="recipe-source" href={recipe.url} target="_blank" rel="noreferrer">Read the original recipe <span aria-hidden="true">↗</span></a></Button>
    </Card>)}</div>
  </section>;
}
