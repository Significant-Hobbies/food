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
      <label htmlFor="recipe-search" className="search-field">Find a recipe<Input id="recipe-search" type="search" value={filters.query} onChange={(event) => update({ query: event.target.value })} placeholder="Tofu, paneer, chickpeas…" /></label>
      <label htmlFor="recipe-diet">Diet<select id="recipe-diet" value={filters.dietary} onChange={(event) => update({ dietary: event.target.value })}><option value="all">All vegetarian</option><option value="vegan">Vegan</option><option value="vegetarian">Vegetarian with dairy</option></select></label>
      <label htmlFor="recipe-format">Meal type<select id="recipe-format" value={filters.format} onChange={(event) => update({ format: event.target.value })}><option value="all">All meal types</option>{formats.map((format) => <option key={format} value={format}>{format.replaceAll("-", " ")}</option>)}</select></label>
      <label htmlFor="recipe-protein">Protein source<select id="recipe-protein" value={filters.proteinSource} onChange={(event) => update({ proteinSource: event.target.value })}><option value="all">All sources</option>{Object.entries(proteinSources).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label htmlFor="recipe-india">Ingredients in India<select id="recipe-india" value={filters.indiaFit} onChange={(event) => update({ indiaFit: event.target.value })}><option value="all">Any availability</option><option value="easy">Easy to find</option><option value="adaptable">Some substitutions</option><option value="specialty">Specialist ingredients</option></select></label>
      <label htmlFor="recipe-sort">Order by<select id="recipe-sort" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}><option value="curated">Collection order</option><option value="protein-density">Protein / 100 kcal</option><option value="protein">Protein per serving</option><option value="calories">Fewest calories</option><option value="title">Recipe name</option></select></label>
    </div>
    <fieldset className="recipe-exclusions"><legend>Leave out</legend>{Object.entries(ingredientExclusions).map(([key, { label }]) => <label key={key}><input type="checkbox" checked={filters.excludedIngredients.includes(key)} onChange={(event) => update({ excludedIngredients: event.target.checked ? [...filters.excludedIngredients, key] : filters.excludedIngredients.filter((value) => value !== key) })} />{label}</label>)}</fieldset>
    <div className="recipe-result-heading"><p role="status">{results.length} {results.length === 1 ? "recipe" : "recipes"}{results.length !== recipes.length ? ` of ${recipes.length}` : ""}</p><Button variant="ghost" onClick={() => setFilters(defaultRecipeFilters)}>Reset filters</Button></div>
    <p className="recipe-evidence-note">Macros are publisher estimates per stated serving, not lab-verified values. Ingredient filters match the recorded list; check the original recipe and packaging for allergens.</p>
    {results.length === 0 && <div className="empty"><strong>No recipes match those choices.</strong><span>Remove an exclusion or try a different protein source.</span></div>}
    <div className="recipe-grid">{results.map((recipe) => <article className="recipe-card" key={recipe.id}>
      <div className="recipe-identity"><h2><a href={recipe.url} target="_blank" rel="noreferrer">{recipe.title}</a></h2><p>{recipe.publisher} · {recipe.format.replaceAll("-", " ")} · {recipe.dietary}</p><p className="recipe-fit">{recipe.indiaFitNote}</p></div>
      <div className="recipe-macros"><div><strong>{recipe.nutrition.protein ?? "—"}<small> g</small></strong><span>protein{recipe.nutrition.proteinQualifier ? ` · ${recipe.nutrition.proteinQualifier}` : ""}</span></div><div><strong>{recipe.nutrition.calories ?? "—"}</strong><span>kcal{recipe.nutrition.calorieQualifier ? ` · ${recipe.nutrition.calorieQualifier}` : ""}</span></div><div><strong>{recipeDensity(recipe) ?? "—"}<small> g</small></strong><span>protein / 100 kcal</span></div></div>
      <p className="recipe-serving">Per {recipe.nutrition.servingBasis.replace(/^1 /, "one ")} · publisher-stated</p>
      <details><summary>{recipe.ingredients.length} ingredients & source notes</summary><ul>{recipe.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul><p>{recipe.nutrition.sourceNote}</p></details>
      <a className="recipe-source" href={recipe.url} target="_blank" rel="noreferrer">Read the original recipe <span aria-hidden="true">↗</span></a>
    </article>)}</div>
  </section>;
}
