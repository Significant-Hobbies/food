-- Public conflict projection and filtering probe only one product's open reviews.
CREATE INDEX IF NOT EXISTS idx_review_product_status_type
  ON review_items(product_id, status, type);
