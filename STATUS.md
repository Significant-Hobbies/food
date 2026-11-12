# Food

Food unifies the Protein Index catalog and Recipe Index collection. Canonical source is Significant-Hobbies/food; the target is food.significanthobbies.com. The owner selected Label Desk and the shared UI library 0.1.33.

The prepared Open Food Facts Parquet snapshot and its quality report are in data/food-quality.json. Community records remain unverified; exact flagged conflicts have no protein ranking. Recipes retain publisher estimates and original links.

Run `pnpm check`, `python3 test/test_off_parquet.py` and `pnpm docs:validate` for source qualification. Deployment is manual and guarded against dirty, unsynced or unqualified source. The running `/api/health` reports the actual version tag and source snapshot; GitHub issue #5 tracks delivery and runtime proof. Historical data/ref recovery is retained without restoring the former retired services.
