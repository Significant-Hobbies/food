# Why / What

Recipe Index is a standalone Astro dashboard for curated, source-linked recipe
collections. Its homepage compares 50 egg-free vegetarian recipes that each
publish at least 10 g protein per serving and at least 10 g protein per 100 kcal.
It favors practical food over shakes and does not provide medical advice.

# Dependencies

- Runtime: Astro 7 on Node.js for local development and static builds.
- Hosting: Cloudflare Pages project `veg-protein-food`, deployed by direct
  Wrangler upload.
- Data: a checked-in multi-publisher recipe collection with source-published
  serving macros, source links, key ingredients, and India-fit notes.
- Production dependencies: Astro only.
- Internal Fleet dependencies: none.

# Timeline

- 2026-08-31 — Wired the product's dedicated Microsoft Clarity project on the
  public no-account index, disclosed its use alongside PostHog, and left
  production unchanged pending a separately approved deploy.
- 2026-08-15 — Published the first public release on Cloudflare Pages at
  `veg-protein-food.significanthobbies.com` from the public Significant Hobbies
  repository.
- 2026-08-15 — Expanded the checked collection to 50 recipes while holding
  drinks at five, accepted concentrated vegetarian protein strategies, and
  added protein-source visibility and filtering.
- 2026-08-15 — Replaced the exhaustive single-channel homepage with a curated
  34-recipe vegetarian collection, enforced the 10+10 protein gates, and made
  the default order 29 foods followed by five drinks.
- 2026-08-15 — Parked as an independent local-only Fleet checkout and
  registered as an active P2 product; no remote or deployment was created.
- 2026-08-14 — Standalone Recipe Index creator page built in Astro with the
  Epic Mint Leaves snapshot, ingredient filtering, nutrition evidence, and
  responsive design proof.
- 2026-08-15 — Replaced the typed exclusion mode with dataset-backed ingredient
  options, removable multi-exclusions, and sortable ledger headings.
- 2026-08-15 — Rebuilt nutrition data from cached public descriptions, repaired
  multi-part ingredient extraction, and restricted density to complete
  same-recipe evidence.

# Products

- Public site: `https://veg-protein-food.significanthobbies.com/`.
- Provider origin: `https://veg-protein-food.pages.dev/`.
- Public source: `https://github.com/Significant-Hobbies/veg-protein-food`.
- Local web app at `http://127.0.0.1:4173/` when the dev server is running.

# Features (shipped)

- A source-linked cooking playbook for eight approachable dishes that clearly
  separates nutrition-verified recipes from related bases and unverified
  technique references.
- 50 egg-free vegetarian recipes from 14 credited publishers, each with a direct
  original blog or YouTube link.
- Automated admission checks for at least 10 g total protein and at least 10 g
  protein per 100 kcal from source-published same-serving macros.
- A food-first catalogue with 45 foods and five explicitly categorized drinks.
- Dataset-backed protein-source filtering across soy/tofu/TVP, tempeh, seitan,
  whey powder, vegan powder, dairy foods, and legumes, with the primary strategy
  visible on every row.
- Ingredient/recipe/publisher search, dataset-backed removable exclusions, and
  format, India-fit, dietary, and sorting controls.
- Clickable desktop ledger headings with synchronized bidirectional sorting.
- Publisher macros, serving basis, key ingredients, India practicality, and
  source caveats in every expandable details panel.
- Responsive accessible recipe rows, direct source links, and lazy details.

# Work queue

<https://github.com/Significant-Hobbies/veg-protein-food/issues>
