"""Load a prepared snapshot into the one generated local D1 catalog."""
import argparse
from pathlib import Path
import sqlite3
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("sql", type=Path)
args = parser.parse_args()
databases = []
for path in Path(".wrangler/state/v3/d1").rglob("*.sqlite"):
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    if connection.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='products'").fetchone()[0]:
        databases.append(path)
    connection.close()
if len(databases) != 1:
    raise RuntimeError(f"Expected exactly one local catalog; found {len(databases)}. Apply local migrations first.")
with args.sql.open("rb") as source:
    subprocess.run(["sqlite3", str(databases[0])], stdin=source, check=True)
connection = sqlite3.connect(f"file:{databases[0]}?mode=ro", uri=True)
assert connection.execute("PRAGMA quick_check").fetchone()[0] == "ok"
print({"target": "local", "products": connection.execute("SELECT count(*) FROM products WHERE is_active=1").fetchone()[0], "database": str(databases[0])})
