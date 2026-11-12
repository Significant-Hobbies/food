-- Restrict this index to source errors so completion's broader queue keeps
-- its status-first index and set-based query plan.
CREATE INDEX IF NOT EXISTS idx_review_open_source_error_product
  ON review_items(product_id)
  WHERE status = 'open' AND type = 'nutrition_validation'
    AND CASE WHEN json_valid(evidence_json)
      THEN json_extract(evidence_json, '$.severity') END = 'error'
    AND CASE WHEN json_valid(evidence_json)
      THEN json_extract(evidence_json, '$.code') END NOT GLOB 'robotoff_*';
