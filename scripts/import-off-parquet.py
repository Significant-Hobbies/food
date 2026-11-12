# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb==2.0.0"]
# ///
"""Extract the complete India slice without changing the source Parquet file."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def language_text(values, language):
    values = values or []
    for preferred in ["en", language, "main"]:
        for item in values:
            if item.get("lang") == preferred and (item.get("text") or "").strip():
                return item["text"]
    return next((item["text"] for item in values if (item.get("text") or "").strip()), None)


def image_url(code, images, kind, language):
    if not code or not code.isdigit():
        return None
    candidates = [image for image in images or [] if image.get("key", "").startswith(kind + "_") and image.get("rev") is not None]
    chosen = next((image for lang in ["en", language] for image in candidates if image["key"] == f"{kind}_{lang}"), candidates[0] if candidates else None)
    if not chosen:
        return None
    padded = code.zfill(13)
    path = "/".join([padded[:3], padded[3:6], padded[6:9], padded[9:]])
    return f"https://images.openfoodfacts.org/images/products/{path}/{chosen['key']}.{chosen['rev']}.400.jpg"


def flatten(row):
    language = row.get("lang") or "en"
    result = {key: value for key, value in row.items() if key not in ["product_name", "generic_name", "ingredients_text", "images", "nutriments"]}
    for key in ["product_name", "generic_name", "ingredients_text"]:
        result[key] = language_text(row.get(key), language)
        result[f"parquet_{key}"] = row.get(key)
    result["nutriments"] = {f"{nutrient['name']}_100g": nutrient["100g"] for nutrient in row.get("nutriments") or [] if nutrient.get("name") and nutrient.get("100g") is not None}
    result["parquet_nutriments"] = row.get("nutriments")
    result["traces"] = ", ".join(row.get("traces_tags") or []) or None
    for kind, field in [("front", "image_url"), ("nutrition", "image_nutrition_url"), ("ingredients", "image_ingredients_url")]:
        result[field] = image_url(row.get("code"), row.get("images"), kind, language)
    result["url"] = f"https://world.openfoodfacts.org/product/{row['code']}"
    return result


def main():
    import duckdb
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    before = args.input.stat()
    connection = duckdb.connect(config={"threads": 2, "memory_limit": "512MB"})
    total = connection.execute("SELECT count(*) FROM read_parquet(?)", [str(args.input)]).fetchone()[0]
    keys = ["code", "product_name", "generic_name", "brands", "countries_tags", "quantity", "product_quantity", "product_quantity_unit", "serving_size", "serving_quantity", "nutrition_data_per", "categories", "categories_tags", "labels", "labels_tags", "ingredients_text", "allergens_tags", "traces_tags", "additives_tags", "nutriments", "lang", "images", "last_modified_t", "last_updated_t", "data_quality_errors_tags", "data_quality_warnings_tags", "states_tags", "obsolete"]
    cursor = connection.execute(f"SELECT {','.join(keys)} FROM read_parquet(?) WHERE list_contains(countries_tags, 'en:india') ORDER BY code", [str(args.input)])
    count = 0
    source_errors = 0
    maximum_modified = 0
    target = args.output / "india-source.jsonl"
    with target.open("w") as output:
        while rows := cursor.fetchmany(1000):
            for values in rows:
                row = dict(zip(keys, values))
                output.write(json.dumps(flatten(row), ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n")
                count += 1
                source_errors += bool(row.get("data_quality_errors_tags"))
                maximum_modified = max(maximum_modified, row.get("last_modified_t") or 0)
    digest = hashlib.file_digest(args.input.open("rb"), "sha256").hexdigest()
    after = args.input.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise RuntimeError("Parquet source changed during extraction; do not publish this snapshot")
    if count == 0:
        raise RuntimeError("No India rows found; refusing an empty snapshot")
    manifest = {"source": "Open Food Facts Parquet", "sourceFile": args.input.name, "sourceBytes": before.st_size, "sourceSha256": digest, "sourceRows": total, "indiaRows": count, "rowsWithSourceErrors": source_errors, "latestProductModifiedAt": datetime.fromtimestamp(maximum_modified, timezone.utc).isoformat(), "extractedAt": datetime.now(timezone.utc).isoformat(), "completeCountryQuery": True, "duckdbVersion": duckdb.__version__, "extractFile": target.name, "extractSha256": hashlib.file_digest(target.open("rb"), "sha256").hexdigest(), "scope": "All records whose countries_tags contains en:india. Numeric and identity validation is a separate stage."}
    (args.output / "parquet-source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
