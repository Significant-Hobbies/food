import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("off_parquet", Path(__file__).resolve().parents[1] / "scripts/import-off-parquet.py")
parquet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parquet)


class ParquetBoundaryTests(unittest.TestCase):
    def test_language_fallback_preserves_real_text(self):
        names = [{"lang": "main", "text": "Nom"}, {"lang": "en", "text": "Name"}]
        self.assertEqual(parquet.language_text(names, "fr"), "Name")
        self.assertIsNone(parquet.language_text([], "en"))

    def test_zero_is_retained_and_missing_is_never_zero(self):
        row = {"code": "12345678", "lang": "en", "nutriments": [{"name": "proteins", "100g": 0}, {"name": "fat", "100g": None}]}
        result = parquet.flatten(row)
        self.assertEqual(result["nutriments"], {"proteins_100g": 0})
        self.assertIsNone(result["ingredients_text"])
        self.assertIsNone(result["image_nutrition_url"])
        self.assertEqual(result["parquet_nutriments"], row["nutriments"])

    def test_selected_image_revisions_use_original_barcode_path(self):
        images = [{"key": "front_fr", "rev": 3}, {"key": "front_en", "rev": 8}, {"key": "nutrition_en", "rev": 6}]
        self.assertEqual(parquet.image_url("00024907", images, "front", "fr"), "https://images.openfoodfacts.org/images/products/000/000/002/4907/front_en.8.400.jpg")
        self.assertIsNone(parquet.image_url("../invalid", images, "front", "en"))


if __name__ == "__main__":
    unittest.main()
