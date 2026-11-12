"""Build the public quality report and licensed source download from exact artifacts."""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3

def file_digest(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(8 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("stage", type=Path)
parser.add_argument("parquet", type=Path)
args = parser.parse_args()
project = Path(__file__).resolve().parents[1]
stage = json.loads((args.stage / "manifest.json").read_text())
source = json.loads((args.parquet / "parquet-source-manifest.json").read_text())
extract = args.parquet / source["extractFile"]
assert file_digest(extract) == source["extractSha256"] == stage["inputHash"]
assert source["completeCountryQuery"] and stage["sourceComplete"]
assert source["indiaRows"] == stage["indiaRecords"] == stage["stagedRecords"] + stage["invalidRecords"] + stage["duplicateRecords"]
counts = Counter()
for line in (args.stage / "staged-products.jsonl").open():
    record = json.loads(line)
    nutrition = record["nutrition"]["per100g"]
    counts["usableNutrition"] += nutrition["calories"] is not None and nutrition["calories"] > 0 and nutrition["proteinGrams"] is not None and record["nutrition"]["status"] == "unverified"
    counts["completeCoreMacros"] += all(nutrition[field] is not None for field in ["calories", "proteinGrams", "carbohydrateGrams", "fatGrams", "fibreGrams"])
    counts["withIngredients"] += bool(record["ingredients"]["raw"])
    counts["nutritionConflicts"] += record["nutrition"]["status"] == "conflict"
    counts["missingNutrition"] += record["nutrition"]["status"] == "missing"
    counts["withLabelImage"] += bool(record["nutritionImageUrl"])
    for issue in record["validationIssues"]:
        counts["kilojouleConversions"] += issue["code"] == "calories_derived_from_kj"
        counts["sourceErrors"] += issue["code"] == "source_nutrition_error"
databases = []
for path in (project / ".wrangler/state/v3/d1").rglob("*.sqlite"):
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    if connection.execute("SELECT count(*) FROM sqlite_master WHERE name='products'").fetchone()[0]:
        databases.append(path)
    connection.close()
assert len(databases) == 1, "Exactly one imported local D1 catalog is required"
connection = sqlite3.connect(f"file:{databases[0]}?mode=ro", uri=True)
canonical = connection.execute("SELECT count(*) FROM products WHERE is_active=1").fetchone()[0]
assert canonical > 0, "Load the prepared snapshot before reporting canonical product counts"
assert connection.execute("SELECT count(*) FROM source_records").fetchone()[0] == stage["stagedRecords"]
quality = {
    **counts, "source": "Open Food Facts Parquet", "sourceUpdatedAt": source["latestProductModifiedAt"],
    "importedAt": stage["completedAt"], "recordsRead": source["sourceRows"], "indiaRecords": stage["indiaRecords"],
    "stagedRecords": stage["stagedRecords"], "excludedRecords": stage["invalidRecords"] + stage["duplicateRecords"],
    "canonicalProducts": canonical, "duplicateBarcodes": stage["duplicateRecords"],
    "downloadPath": "/data/open-food-facts-india.jsonl.gz", "sourceSha256": source["sourceSha256"],
    "extractSha256": source["extractSha256"], "adapterVersion": stage["adapterVersion"],
    "labelSpotChecks": json.loads((project / "data/label-spot-checks.json").read_text()),
    "license": "ODbL-1.0", "sourceUrl": "https://world.openfoodfacts.org/data",
    "limitations": [
        "Community records are not independently verified labels. Numeric validation cannot detect every mismatched product, ingredient list or image.",
        "India country tags do not establish present retail availability. This is not complete coverage of the Indian market.",
        "Observation dates refer to the contributor record, not a package manufacture date. The latest source edit is not an export publication date.",
        "Nutrition uses the declared per-100-g or per-100-ml basis. Mass and volume are never converted without density evidence.",
        "Unknown nutrition remains null. Zero is kept only when explicitly provided by the source. Conflicting nutrition does not receive a protein-density ranking.",
        "The 50 curated recipes retain publisher-stated serving estimates and are separate from the food-label dataset.",
    ],
}
(project / "data/food-quality.json").write_text(json.dumps(quality, indent=2) + "\n")
download = project / "public/data/open-food-facts-india.jsonl.gz"
with extract.open("rb") as stream, gzip.GzipFile(filename=str(download), mode="wb", mtime=0) as output:
    shutil.copyfileobj(stream, output)
(project / "public/data/open-food-facts-manifest.json").write_text(json.dumps({"parquet": source, "validation": stage, "quality": quality}, indent=2) + "\n")
print(json.dumps(quality, indent=2))
