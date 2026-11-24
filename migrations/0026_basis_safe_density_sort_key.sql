-- Match the catalog's effective basis before calculating its stored density.
-- Keep the view name used by the existing triggers and preserve the paging index.
DROP VIEW product_density_sort_keys;

CREATE VIEW product_density_sort_keys AS
WITH density_inputs AS (
  SELECT p.id AS product_id,
    (verified_nutrition.product_id IS NOT NULL
      OR machine_nutrition.product_id IS NOT NULL
      OR n.status IN ('verified', 'unverified')) AS eligible,
    COALESCE(verified_nutrition.calories,
      CASE WHEN machine_nutrition.basis = COALESCE(verified_nutrition.basis, machine_nutrition.basis, n.basis)
        THEN machine_nutrition.calories END,
      CASE WHEN n.basis = COALESCE(verified_nutrition.basis, machine_nutrition.basis, n.basis)
        THEN n.calories END) AS calories,
    COALESCE(verified_nutrition.protein_grams,
      CASE WHEN machine_nutrition.basis = COALESCE(verified_nutrition.basis, machine_nutrition.basis, n.basis)
        THEN machine_nutrition.protein_grams END,
      CASE WHEN n.basis = COALESCE(verified_nutrition.basis, machine_nutrition.basis, n.basis)
        THEN n.protein_grams END) AS protein_grams
  FROM products p
  LEFT JOIN nutrition_facts n ON n.product_id = p.id
  LEFT JOIN current_verified_nutrition_facts verified_nutrition
    ON verified_nutrition.product_id = p.id
  LEFT JOIN (
    SELECT product_id, basis, calories, protein_grams
    FROM (
      SELECT candidate.product_id, candidate.basis, candidate.calories, candidate.protein_grams,
        ROW_NUMBER() OVER (
          PARTITION BY candidate.product_id ORDER BY candidate.verified_at DESC, candidate.id DESC
        ) AS density_rank
      FROM current_machine_verified_nutrition_facts candidate
    )
    WHERE density_rank = 1
  ) machine_nutrition ON machine_nutrition.product_id = p.id
)
SELECT product_id,
  CASE WHEN eligible AND calories > 0 AND protein_grams >= 0
      AND protein_grams * 4.0 <= calories
    THEN protein_grams * 100.0 / calories
  END AS sort_protein_density
FROM density_inputs;

-- Calculate the projection once and update only rows whose key changed.
WITH target_keys AS MATERIALIZED (
  SELECT product_id, sort_protein_density FROM product_density_sort_keys
)
UPDATE products
SET sort_protein_density = target_keys.sort_protein_density
FROM target_keys
WHERE products.id = target_keys.product_id
  AND products.sort_protein_density IS NOT target_keys.sort_protein_density;
