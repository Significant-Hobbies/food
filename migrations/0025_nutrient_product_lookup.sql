-- Bound product-detail nutrient reads without changing evidence or trust policy.
CREATE INDEX IF NOT EXISTS idx_nutrient_values_product_code
  ON nutrient_values(product_id, nutrient_code);
