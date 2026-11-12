# Recipe Index

A standalone Astro ledger for protein-dense egg-free vegetarian recipes. The
checked collection contains 50 original-source-linked recipes that each publish
at least 10 g protein per serving and at least 10 g protein per 100 kcal.

Live at <https://veg-protein-food.significanthobbies.com/>.

The homepage is food-first: 45 meals, components, breads, breakfasts, bars, and
desserts appear before five explicitly categorized drinks. Search ingredients,
recipes, or publishers; remove recipes through multi-select ingredient
exclusions; filter by protein source, format, diet, or India fit; sort from the controls or
desktop ledger headings; and open the original source from every row.

## Cooking reference

The [easy high-protein cooking playbook](docs/EASY_HIGH_PROTEIN_DISHES.md)
documents the eight dishes explored during curation, including their protein
base, concise cooking method, density pitfalls, original recipe references,
and whether the exact dish has passed the dashboard's nutrition gates.

## Local development

```bash
npm run dev
```

Open <http://127.0.0.1:4173/>.

## Checks

```bash
npm test
npm run check
```

`npm run check` enforces the collection size, the two protein gates, the
45-food/5-drink composition, normalized protein-source metadata, source attribution, Astro build, and the standalone
product boundary. Astro is the only direct production dependency.

## Deployment

The static `dist/` build is deployed directly to the `veg-protein-food`
Cloudflare Pages project:

```bash
npm run check
npx --yes wrangler@4.123.0 pages deploy dist \
  --project-name veg-protein-food --branch main
```
